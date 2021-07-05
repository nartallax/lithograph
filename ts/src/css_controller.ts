import {Lithograph} from "lithograph";
import * as CleanCSS from "clean-css";
import {promises as Fs} from "fs";
import {allKnownMimeTypes} from "mime";
import {getFileContentHash, getFileListRecursive, writeFileAndCreateDirs} from "lithograph_utils";
import {LithographContentController} from "content_controller";
import {LithographContentSet} from "content_set";
import {LithographRenderContext} from "render_context";

export interface CssControllerOptions {
	minify: () => boolean;
	validate: () => boolean;
	useHashes: () => boolean;
	contentSet: LithographContentSet;
}

interface CssContentItem {
	builder: Lithograph.CssFileBuilder;
	hash?: string;
}

export class LithographCssController implements LithographContentController {

	private cssFiles: string[] = [];
	private cssDirs: string[] = [];
	private contentItems: Map<string, CssContentItem> = new Map();
	

	constructor(private readonly opts: CssControllerOptions){}
	
	addContentItem(urlPath: string, builder: Lithograph.CssFileBuilder): void {
		if(this.contentItems.has(urlPath)){
			throw new Error("Duplicate CSS file: " + urlPath);
		}
		this.contentItems.set(urlPath, { builder });
	}

	async onResourceDefinitionCompleted(): Promise<void> {
		if(!this.opts.useHashes()){
			return; // no hashes = no reason to build css ASAP
		}

		await Promise.all([...this.contentItems.entries()].map(async ([urlPath, contentItem]) => {
			let css = await this.formCompletedCss(urlPath, contentItem.builder);
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
			getContent: () => this.formCompletedCss(urlPath, contentItem.builder)
		}
	}
	
	addDirectory(path: string){
		this.cssDirs.push(path);
	}

	addFile(path: string){
		this.cssFiles.push(path);
	}

	private sourceCssFiles: Promise<Map<string, string>> | null = null;
	private getSourceCss(): Promise<Map<string, string>>{
		return this.sourceCssFiles ||= this.readSourceCss();
	}

	private async readSourceCss(): Promise<Map<string, string>>{
		let allPaths = [...this.cssFiles];
		await Promise.all(this.cssDirs.map(dirPath => getFileListRecursive(dirPath, allPaths)));
		allPaths = allPaths.filter(x => x.toLowerCase().endsWith(".css"));
		let result: Map<string, string> = new Map();
		await Promise.all(allPaths.map(async cssFilePath => {
			let content = await Fs.readFile(cssFilePath, "utf8")
			let fullFilePath = this.opts.contentSet.pathController.pathResolveStable(cssFilePath);
			result.set(fullFilePath, content);
		}));
		return result;
	}

	private async createBuildingContext(urlPath: string): Promise<Lithograph.CssBuildingContext> {
		let files = await this.getSourceCss();
		return new LithographCssBuildingContext(this.opts.contentSet, urlPath, files);
	}

	private async formCompletedCss(urlPath: string, builder: Lithograph.CssFileBuilder): Promise<string>{
		let buildContext = await this.createBuildingContext(urlPath);
		let css = builder(buildContext);

		if(this.opts.minify() || this.opts.validate()){
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
			let css = await this.formCompletedCss(urlPath, contentItem.builder)
			await writeFileAndCreateDirs(filePath, css)
		}));
	}

}	

class LithographCssBuildingContext extends LithographRenderContext {

	constructor(contentSet: LithographContentSet, urlPath: string, readonly allKnownFiles: Map<string, string>){
		super(contentSet, urlPath);
	}

	file(filePath: string): string {
		let resolvedFilePath = this.contentSet.pathController.pathResolveStable(filePath);
		let content = this.allKnownFiles.get(resolvedFilePath);
		if(content === undefined){
			throw new Error(`Failure during building css file ${this.urlPath}: no source css file found at ${filePath}`);
		}
		return content;
	}

	directory(filePath: string): string[] {
		filePath = this.contentSet.pathController.pathResolveStable(filePath);
		let result: string[] = [];
		for(let [k, v] of this.allKnownFiles){
			if(this.contentSet.pathController.isPathInsidePath(k, filePath)){
				result.push(v);
			}
		}
		return result.sort(); // just for stability of output
	}



}