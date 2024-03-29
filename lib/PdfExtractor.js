'use strict';

// HACK few hacks to let PDF.js be loaded not as a module in global space.
const domFacade = require('./pdfjs-utils/domfacade');
const fs = require('fs');
const PDFJSLib = require('pdfjs-dist');
const MetaDataHandler = require('./MetaDataHandler');
const CanvasRenderer = require('./renderer/CanvasRenderer');
const JsonRenderer = require('./renderer/JsonRenderer');
const SvgRenderer = require('./renderer/SvgRenderer');
const packageJson = require('../package.json');

PDFJSLib.PDFJS.disableFontFace = true;

class PdfExtractor {
	constructor(outputDir, options) {
		options = options || {};

		this.pageRange = options.pageRange || [1, Infinity];

		fs.accessSync(outputDir, fs.R_OK | fs.W_OK);

		let viewportScale = options.viewportScale || 1.5;

		this.renderers = Array.isArray(options.renderers) ? options.renderers : [
			new CanvasRenderer(outputDir, viewportScale, options),
			new SvgRenderer(outputDir, viewportScale, options)
		];

		this.metaDataHandler = new MetaDataHandler(packageJson.version);

		this.jsonRenderer = new JsonRenderer(outputDir, viewportScale, options);
		this.jsonRenderer.setMetaDataHandler(this.metaDataHandler);
	}

	parse(pdfPath) {
		return this.parseFromFileBuffer(fs.readFileSync(pdfPath));
	}

	parseFromFileBuffer(pdfBuffer) {
		// Read the PDF file into a typed array so PDF.js can load it.
		let rawData = new Uint8Array(pdfBuffer);

		domFacade.setGlobalDom();

		return PDFJSLib.getDocument({
			data: rawData,
			// Try to export JPEG images directly if they don't need any further processing.
			nativeImageDecoderSupport: PDFJSLib.NativeImageDecoding.DISPLAY
		}).then((doc) => this.parseDocument(doc))
			.then(() => this.metaDataHandler);
	}

	parseDocument(doc) {
		let numPages = doc.numPages,
			minPage = this.pageRange[0],
			maxPage = this.pageRange[1] > numPages ? numPages : this.pageRange[1];

		// chain promises
		let lastPromise = Promise.resolve(),
			loadPage = (pageNum) => {
				return () => doc.getPage(pageNum).then((page) => this.renderPageData(page));
			};

		for (let i = 1; i <= numPages; i++) {
			if (i < minPage || i > maxPage) {
				continue;
			}
			lastPromise = lastPromise.then(loadPage(i));
		}

		return lastPromise.then(() => {
			return this.renderMetaData(doc);
		}).then(() => {
			return this.renderDocumentData(doc);
		});
	}

	renderPageData(page) {
		let lastPromise = this.jsonRenderer.renderPage(page);
		for (let renderer of this.renderers) {
			renderer.setMetaDataHandler(this.metaDataHandler);
			lastPromise = lastPromise.then(() => {
				return renderer.renderPage(page);
			});
		}
		return lastPromise;
	}

	renderMetaData(doc) {
		return doc.getMetadata().then((metaData) => {
			this.metaDataHandler.pdfMetaData = this.metaDataHandler.jsonData.pdfMetaData = metaData;
			return doc.getOutline();
		}).then((outline) => {
			this.metaDataHandler.pdfOutline = this.metaDataHandler.jsonData.pdfOutline = outline;
			return doc.getPageLabels();
		}).then((pdfPageLabels) => {
			this.metaDataHandler.pdfPageLabels = this.metaDataHandler.jsonData.pdfPageLabels = pdfPageLabels;
			return doc.getDestinations();
		}).then((pdfDestinations) => {
			this.metaDataHandler.pdfDestinations = this.metaDataHandler.jsonData.pdfDestinations = pdfDestinations;
		});
	}

	renderDocumentData(doc) {
		// chain promises
		let lastPromise = Promise.resolve();
		for (let renderer of this.renderers) {
			if (renderer.renderDocument) {
				lastPromise = lastPromise.then(() => {
					return renderer.renderDocument(doc)
				});
			}
		}
		return lastPromise.then(() => {
			return this.jsonRenderer.renderDocument(doc)
		});
	}
}

module.exports = PdfExtractor;
