const path = require('path')
const pdfjs = require('pdfjs-dist')
pdfjs.GlobalWorkerOptions.workerSrc = `pdfjs-dist/legacy/build/pdf.worker`

const { findPageNumbers, findFirstPage, removePageNumber } = require('./page-number-functions')
const TextItem = require('../models/TextItem')
const Page = require('../models/Page')

const NO_OP = () => {}

/**
 * Parses the PDF document contained in the provided buffer and invokes callback functions during the parsing process.
 *
 * @param {Buffer} buffer The buffer containing the PDF document to be parsed. This should be a Buffer type, which represents binary data in memory.
 * @param {Object} [callbacks] An object containing callback functions that are called at various stages of the parsing process. Each callback is optional.
 * @param {Function} [callbacks.metadataParsed] Called when the metadata of the PDF has been parsed. The function should accept a single parameter: an object representing the parsed metadata.
 * @param {Function} [callbacks.pageParsed] Called when a page of the PDF has been parsed. The function should accept a single parameter: an array of objects representing the parsed pages.
 * @param {Function} [callbacks.fontParsed] Called when a font used in the PDF has been parsed. The function should accept a single parameter: an object representing the parsed font.
 * @param {Function} [callbacks.documentParsed] Called when the entire document has been parsed. The function should accept two parameters: the first is an object representing the parsed document, and the second is an array of objects representing all parsed pages.
 * @returns {Promise<void>} A promise that resolves when the parsing process is complete.
 */
exports.parse = async function parse(buffer, callbacks) {
    const { metadataParsed, pageParsed, fontParsed, documentParsed } = {
        metadataParsed: NO_OP,
        pageParsed: NO_OP,
        fontParsed: NO_OP,
        documentParsed: NO_OP,
        ...(callbacks || {})
    }
    const fontDataPath = path.join(path.resolve(require.resolve('pdfjs-dist'), '../../standard_fonts'), '/')
    const pdfDocument = await pdfjs.getDocument({
        data: new Uint8Array(buffer),
        standardFontDataUrl: fontDataPath
    }).promise
    const metadata = await pdfDocument.getMetadata()
    metadataParsed(metadata)

    const pages = [...Array(pdfDocument.numPages).keys()].map(index => new Page({ index }))

    documentParsed(pdfDocument, pages)

    const fonts = {
        ids: new Set(),
        map: new Map()
    }

    let pageIndexNumMap = {}
    let firstPage
    for (let j = 1; j <= pdfDocument.numPages; j++) {
        const page = await pdfDocument.getPage(j)
        const textContent = await page.getTextContent()

        if (Object.keys(pageIndexNumMap).length < 10) {
            pageIndexNumMap = findPageNumbers(pageIndexNumMap, page.pageNumber - 1, textContent.items)
        } else {
            firstPage = findFirstPage(pageIndexNumMap)
            break
        }
    }

    let pageNum = firstPage ? firstPage.pageNum : 0
    for (let j = 1; j <= pdfDocument.numPages; j++) {
        const page = await pdfDocument.getPage(j)

        // Trigger the font retrieval for the page
        await page.getOperatorList()

        const scale = 1.0
        const viewport = page.getViewport({ scale })
        let textContent = await page.getTextContent()
        if (firstPage && page.pageIndex >= firstPage.pageIndex) {
            textContent = removePageNumber(textContent, pageNum)
            pageNum++
        }
        const textItems = textContent.items.map(item => {
            const tx = pdfjs.Util.transform(viewport.transform, item.transform)

            const fontHeight = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3])
            const dividedHeight = item.height / fontHeight
            return new TextItem({
                x: Math.round(item.transform[4]),
                y: Math.round(item.transform[5]),
                width: Math.round(item.width),
                height: Math.round(dividedHeight <= 1 ? item.height : dividedHeight),
                text: item.str,
                font: item.fontName
            })
        })
        pages[page.pageNumber - 1].items = textItems
        pageParsed(pages)

        const fontIds = new Set(textItems.map(t => t.font))
        for (const fontId of fontIds) {
            if (!fonts.ids.has(fontId) && fontId.startsWith('g_d')) {
                // Depending on which build of pdfjs-dist is used, the
                // WorkerTransport containing the font objects is either transport or _transport
                const transport = pdfDocument.transport || pdfDocument._transport // eslint-disable-line no-underscore-dangle
                const font = await new Promise(resolve => transport.commonObjs.get(fontId, resolve))
                fonts.ids.add(fontId)
                fonts.map.set(fontId, font)
                fontParsed(fonts)
            }
        }
    }
    return {
        fonts,
        metadata,
        pages,
        pdfDocument
    }
}
