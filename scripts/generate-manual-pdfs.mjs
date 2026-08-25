#!/usr/bin/env node
/**
 * 把 docs/manual/*.md 轉成同名的 .pdf，並正確渲染內文中的 mermaid 流程圖。
 *
 * 原理：
 * 1. 掃描每份 .md，找出所有 ```mermaid ... ``` 區塊。
 * 2. 用 @mermaid-js/mermaid-cli（mmdc）把每個區塊離線渲染成 SVG
 *    （存到暫存目錄，PDF 產生後清除），避免在 md-to-pdf 的 Puppeteer
 *    頁面裡用線上 mermaid.js 渲染時，難以確保「JS 渲染完成才列印」
 *    的競態問題。
 * 3. 把原本的 mermaid code fence 換成 <img> 指向渲染好的 SVG。
 * 4. 用 md-to-pdf（Puppeteer/Chromium 產生 PDF，與現有 PDF 的
 *    Producer: Skia/PDF 機制一致）轉成同目錄同檔名的 .pdf。
 *
 * 用法：
 *   node scripts/generate-manual-pdfs.mjs              # 轉全部 docs/manual/*.md
 *   node scripts/generate-manual-pdfs.mjs 01-學員管理.md  # 只轉指定檔案
 */
import { mdToPdf } from 'md-to-pdf'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readdir, readFile, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MANUAL_DIR = path.join(__dirname, '..', 'docs', 'manual')
const STYLESHEET = path.join(__dirname, 'docs-pdf.css')
const MERMAID_FENCE = /```mermaid\n([\s\S]*?)```/g

/** 把單一 mermaid 原始碼渲染成 SVG 檔，回傳 SVG 內容字串（inline embed，避免額外圖檔路徑問題） */
async function renderMermaidToSvg(mermaidSource, tmpDir, index) {
  const inputPath = path.join(tmpDir, `diagram-${index}.mmd`)
  const outputPath = path.join(tmpDir, `diagram-${index}.svg`)
  await writeFile(inputPath, mermaidSource, 'utf-8')

  const mmdcBin = path.join(__dirname, '..', 'node_modules', '.bin', 'mmdc')
  await execFileAsync(mmdcBin, [
    '-i', inputPath,
    '-o', outputPath,
    '--backgroundColor', 'white',
    '--puppeteerConfigFile', path.join(__dirname, 'mmdc-puppeteer-config.json'),
  ])

  return readFile(outputPath, 'utf-8')
}

/** 把 markdown 內容中的 mermaid code fence 換成 base64 內嵌的 <img>，回傳處理後的 markdown */
async function replaceMermaidBlocks(markdown, tmpDir) {
  const matches = [...markdown.matchAll(MERMAID_FENCE)]
  if (matches.length === 0) return markdown

  let result = markdown
  let index = 0
  for (const match of matches) {
    const [fullMatch, mermaidSource] = match
    const svg = await renderMermaidToSvg(mermaidSource.trim(), tmpDir, index)
    const base64 = Buffer.from(svg, 'utf-8').toString('base64')
    const imgTag = `<img class="mermaid-diagram" src="data:image/svg+xml;base64,${base64}" alt="流程圖" />`
    result = result.replace(fullMatch, imgTag)
    index++
  }
  return result
}

async function convertOne(mdFilename) {
  const mdPath = path.join(MANUAL_DIR, mdFilename)
  const pdfPath = mdPath.replace(/\.md$/, '.pdf')
  const raw = await readFile(mdPath, 'utf-8')

  const tmpDir = await mkdtemp(path.join(tmpdir(), 'manual-mermaid-'))
  try {
    const processed = await replaceMermaidBlocks(raw, tmpDir)

    const pdf = await mdToPdf(
      { content: processed },
      {
        dest: pdfPath,
        stylesheet: [STYLESHEET],
        document_title: mdFilename.replace(/\.md$/, ''),
        pdf_options: {
          format: 'A4',
          margin: '15mm 18mm',
          printBackground: true,
        },
        launch_options: {
          args: ['--no-sandbox'],
        },
      }
    )
    if (!pdf) throw new Error(`PDF 產生失敗：${mdFilename}`)
    console.log(`✓ ${mdFilename} → ${path.basename(pdfPath)}`)
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}

async function main() {
  const requested = process.argv.slice(2)
  const allMdFiles = (await readdir(MANUAL_DIR)).filter((f) => f.endsWith('.md'))
  const targets = requested.length > 0
    ? requested.filter((f) => {
        if (!existsSync(path.join(MANUAL_DIR, f))) {
          console.warn(`⚠ 找不到 ${f}，略過`)
          return false
        }
        return true
      })
    : allMdFiles

  if (targets.length === 0) {
    console.error('沒有可轉換的 .md 檔案')
    process.exit(1)
  }

  console.log(`準備轉換 ${targets.length} 份手冊…\n`)
  for (const f of targets) {
    await convertOne(f)
  }
  console.log('\n全部完成。')
  process.exit(0)
}

main().catch((err) => {
  console.error('轉檔失敗：', err)
  process.exit(1)
})
