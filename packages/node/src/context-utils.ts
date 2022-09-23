import { createCollector, createPlugins, parseFile } from '@css-panda/ast'
import { Stylesheet } from '@css-panda/core'
import { logger, quote } from '@css-panda/logger'
import type { Config } from '@css-panda/types'
import { outdent } from 'outdent'
import { isAbsolute, join } from 'path'
import { createContext, PandaContext } from './context'
import { generateSystem } from './generators'
import { generateCss, generateKeyframes } from './generators/css'
import { generateReset } from './generators/reset'
import { loadConfig } from './load-config'

function emitComplete(ctx: PandaContext) {
  return [
    outdent`
      We have generated the panda system for you:

      - ${quote(ctx.outdir, '/css')}: the css function to author styles
    `,
    ctx.hasTokens &&
      outdent`
      - ${quote(ctx.outdir, '/design-tokens')}: the css variables and js function to query your tokens
    `,
    ctx.hasRecipes &&
      outdent`
      - ${quote(ctx.outdir, '/patterns')}: functions to implement common css patterns
    `,
    ctx.hasPattern &&
      outdent`
      - ${quote(ctx.outdir, '/recipes')}: functions to create multi-variant styles
    `,
    ctx.jsx &&
      outdent`
      - ${quote(ctx.outdir, '/jsx')}: style prop powered elements for ${ctx.jsxFramework}
    `,
  ]
    .filter(Boolean)
    .join('\n')
}

export async function loadConfigAndCreateContext(options: { cwd?: string; config?: Config } = {}) {
  const { cwd = process.cwd(), config } = options
  const conf = await loadConfig(cwd)
  if (config) {
    Object.assign(conf.config, config)
  }
  return createContext(conf)
}

export async function emitArtifacts(ctx: PandaContext) {
  if (ctx.clean) await ctx.cleanOutdir()
  const tasks = generateSystem(ctx).map((file) => ctx.writeOutput(file))
  await Promise.all(tasks)
  return emitComplete(ctx)
}

export function extractFiles(ctx: PandaContext) {
  return ctx.extract(async (file) => {
    const result = await extractFile(ctx, file)
    if (result) {
      await ctx.assets.write(file, result.css)
      return result
    }
  })
}

export async function emitAndExtract(ctx: PandaContext) {
  await emitArtifacts(ctx)
  await extractFiles(ctx)
}

export async function extractFile(ctx: PandaContext, file: string) {
  const absPath = isAbsolute(file) ? file : join(ctx.cwd, file)

  logger.debug({ type: 'file:extract', file })

  const collector = createCollector()

  const done = logger.time.info('Extracted', quote(file))

  try {
    await parseFile(
      absPath,
      createPlugins({
        data: collector,
        importMap: ctx.importMap,
        fileName: file,
        jsxName: ctx.jsxFactory,
        isUtilityProp: ctx.isProperty,
      }),
    )
  } catch (error) {
    logger.error({ err: error })
  }

  const result = ctx.collectStyles(collector, file)

  if (result) {
    done()
  }

  return result
}

export async function extractAssets(ctx: PandaContext) {
  const sheet = new Stylesheet(ctx.context())

  const imports: string[] = []

  if (ctx.preflight) {
    imports.push('./reset.css')
  }

  if (!ctx.tokens.isEmpty) {
    imports.push('./design-tokens/index.css')
  }

  if (ctx.keyframes) {
    imports.push('./design-tokens/keyframes.css')
  }

  sheet.addImports(imports)

  const files = ctx.assets.getFiles()

  await Promise.all(
    files.map(async (file) => {
      const css = await ctx.assets.readFile(file)
      sheet.append(css)
    }),
  )

  return sheet.toCss()
}

export async function onAssetChange(ctx: PandaContext) {
  const css = await extractAssets(ctx)
  await ctx.write(ctx.outdir, [{ file: 'styles.css', code: css }])
}

export async function onContentChange(ctx: PandaContext, file: string) {
  logger.info(`File changed: ${file}`)
  const result = await extractFile(ctx, file)
  if (!result) return
  await ctx.assets.write(result.file, result.css)
}

export function getBaseCss(ctx: PandaContext) {
  const css = [generateReset(), generateCss(ctx), generateKeyframes(ctx.keyframes)]
  return css.join('\n')
}
