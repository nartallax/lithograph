import {Lithograph, SASSFunction} from "lithograph";
import * as CleanCSS from "clean-css";
import * as SASS from "sass";
import {allKnownMimeTypes} from "mime";
import {getFileContentHash, writeFileAndCreateDirs} from "lithograph_utils";
import {LithographContentController} from "content_controller";
import {LithographContentSet} from "content_set";
import {LithographRenderContext} from "render_context";

export interface CssControllerOptions {
	minify: () => boolean;
	useHashes: () => boolean;
	contentSet: LithographContentSet;
}

interface CssContentItem {
	filePath: string;
	hash?: string;
}

export class LithographCssController implements LithographContentController {

	private sassIncludePaths: string[] = [];
	private sassFunctions: {[name: string]: SASSFunction} = {};
	private contentItems: Map<string, CssContentItem> = new Map();
	
	constructor(private readonly opts: CssControllerOptions){}
	
	addSassItem(urlPath: string, filePath: string): void {
		if(this.contentItems.has(urlPath)){
			throw new Error("Two css files registered at the same url path: " + urlPath);
		}

		this.contentItems.set(urlPath, { filePath });
	}

	addSassIncludePath(dirPath: string): void {
		this.sassIncludePaths.push(dirPath);
	}

	addSassFunction(name: string, fn: SASSFunction): void {
		if(name in this.sassFunctions){
			throw new Error("Could not register SASS function " + name + " twice.");
		}
		this.sassFunctions[name] = fn;
	}

	async onResourceDefinitionCompleted(): Promise<void> {
		if(!this.opts.useHashes()){
			return; // no hashes = no reason to build css ASAP
		}

		await Promise.all([...this.contentItems.entries()].map(async ([urlPath, contentItem]) => {
			let css = await this.formCompletedCss(urlPath, contentItem.filePath);
			contentItem.hash = getFileContentHash(Buffer.from(css, "utf8"));
		}));
	}

	hasContentItem(urlPath: string): boolean {
		return this.contentItems.has(urlPath);
	}

	describeContentItem(urlPath: string): Lithograph.ContentItemDescription | null {
		const contentItem = this.contentItems.get(urlPath);
		if(contentItem === undefined){
			return null;
		}

		return {
			responseType: "ok",
			urlPath,
			mime: allKnownMimeTypes.css,
			hash: contentItem.hash,
			getContent: () => this.formCompletedCss(urlPath, contentItem.filePath)
		}
	}

	private sassRender(opts: SASS.Options): Promise<SASS.Result>{
		return new Promise((ok,bad) => {
			try {
				SASS.render(opts, (error, result) => {
					if(error){
						bad(error);
					} else {
						ok(result);
					}
				})
			} catch(e){
				bad(e)
			}
		})
	}
	
	private async formCompletedCss(urlPath: string, filePath: string): Promise<string>{
		let context = new LithographRenderContext(this.opts.contentSet, urlPath);
		let fns: {[name: string]: SASSFunction} = {} = {}
		for(let name in this.sassFunctions){
			fns[name] = this.sassFunctions[name].bind(context);
		}

		let css = (await this.sassRender({
			file: filePath,
			includePaths: this.sassIncludePaths,
			functions: fns
		})).css.toString("utf-8");

		if(this.opts.minify()){
			let minifier = this.createMinifier();
			let res = await minifier.minify(css);
			let errWarning = (res.errors || []).concat(res.warnings || []);
			if(errWarning.length > 0){
				throw new Error("CSS minification/validation failed:\n" + errWarning.join("\n"));
			}
			if(this.opts.minify()){
				css = res.styles;
			}
		}

		return css;
	}

	private createMinifier(): CleanCSS.MinifierPromise {
		return new CleanCSS({
			compatibility: "ie7", // не повредит
			returnPromise: true,	
			format: false,
			level: 2
		});
	}

	async onWriteAllToDisk(): Promise<void>{
		await Promise.all([...this.contentItems.entries()].map(async ([urlPath, contentItem]) => {
			let filePath = this.opts.contentSet.pathController.urlPathToFilePath(urlPath);
			let css = await this.formCompletedCss(urlPath, contentItem.filePath)
			await writeFileAndCreateDirs(filePath, css)
		}));
	}

}
