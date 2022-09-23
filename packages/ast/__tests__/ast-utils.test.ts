import { describe, test, expect } from 'vitest'
import { cssPlugin } from './fixture'
import { parseSync } from '../src/transform'

describe('ast parser', () => {
  test('[without import] should not parse', () => {
    const code = `
        const baseStyle = css({
            color: 'red',
            fontSize: '12px',
        })

        const testStyle = css({
          bg: "red.300",
          margin: { xs: "0", lg:"40px" },
          padding: [12, 50]
        })
     `

    const collect = new Set()

    parseSync(code, [cssPlugin(collect)])

    expect(collect).toMatchInlineSnapshot('Set {}')
  })

  test('[with import] should parse static property', () => {
    const code = `
    import {css} from ".panda/css";
        const baseStyle = css({
            color: 'red',
            fontSize: '12px',
        })

        const testStyle = css({
          bg: "red.300",
          margin: { xs: "0", lg:"40px" },
          padding: [12, 50]
        })
     `

    const collect = new Set()

    parseSync(code, [cssPlugin(collect)])

    expect(collect).toMatchInlineSnapshot(`
      Set {
        {
          "color": "red",
          "fontSize": "12px",
        },
        {
          "bg": "red.300",
          "margin": {
            "lg": "40px",
            "xs": "0",
          },
          "padding": [
            12,
            50,
          ],
        },
      }
    `)
  })

  test('[with import alias] should parse static property', () => {
    const code = `
    import {css as nCss} from ".panda/css";
        const baseStyle = nCss({
            color: 'red',
            fontSize: '12px',
        })

        const testStyle = nCss({
          bg: "red.300",
          margin: { xs: "0", lg:"40px" },
          padding: [12, 50]
        })
     `

    const collect = new Set()

    parseSync(code, [cssPlugin(collect)])

    expect(collect).toMatchInlineSnapshot(`
      Set {
        {
          "color": "red",
          "fontSize": "12px",
        },
        {
          "bg": "red.300",
          "margin": {
            "lg": "40px",
            "xs": "0",
          },
          "padding": [
            12,
            50,
          ],
        },
      }
    `)
  })

  test('should extract nested css', () => {
    const code = `
      import { css } from '.panda/css'

console.log(
  console.log(
    css({
      selectors: {
        '&:hover': {
          background: 'red.200',
        },
      },
    }),
  ),
)
`
    const collect = new Set()

    parseSync(code, [cssPlugin(collect)])

    expect(collect).toMatchInlineSnapshot(`
      Set {
        {
          "selectors": {
            "&:hover": {
              "background": "red.200",
            },
          },
        },
      }
    `)
  })

  test('should extract complex setup', () => {
    const code = `
      import { css, cx } from '.panda/css'
import React from 'react'

export function Card({ className }) {
  return (
    <div className={cx('card', css({ background: 'white' }), className)}>
      <div></div>
    </div>
  )
}

      `
    const collect = new Set()

    parseSync(code, [cssPlugin(collect)])

    expect(collect).toMatchInlineSnapshot(`
      Set {
        {
          "background": "white",
        },
      }
    `)
  })
})
