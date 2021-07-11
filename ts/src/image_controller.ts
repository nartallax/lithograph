import {Lithograph} from "lithograph";
import {extensionNoDot, getFileContentHash, getFileHash, getFileListRecursive, writeFileAndCreateDirs} from "lithograph_utils";
import * as Path from "path";
import {promises as Fs} from "fs";
import * as ImageSize from "image-size";
import * as Imagemin from "imagemin";
import * as ImageminWebp from "imagemin-webp";
import {LithographPathController} from "path_controller";
import {LithographContentController} from "content_controller";
import {ISize} from "image-size/dist/types/interface";
import {allKnownMimeTypes} from "mime";

export interface LithographImageControllerOptions {
	pathController: LithographPathController;
	useHashes: () => boolean;
}

interface InternalImageInfo extends Lithograph.ImageInfo {
	filePath: string;
	hash: string | undefined;
}

export class LithographImageController implements LithographContentController {

	private knownImages = new Map<string, InternalImageInfo>();
	private webpPath: string | null = null;
	private imageDirectory: string | null = null;
	private readonly supportedImageFormats = new Set(["jpg", "jpeg", "png", "svg", "webp", "gif"]);

	constructor(private readonly opts: LithographImageControllerOptions){}

	get hasWebp(): boolean {
		return !!this.webpPath;
	}

	setImageDirectory(dirPath: string): void {
		if(this.imageDirectory){
			throw new Error("You cannot set image directory path twice!");
		}
		this.imageDirectory = dirPath;
	}

	setWebpPath(dirPath: string): void{
		if(this.webpPath){
			throw new Error("You cannot set Webp directory path twice!");
		}
		this.webpPath = dirPath;
	}

	async onResourceDefinitionCompleted(): Promise<void> {
		if(this.imageDirectory){
			await this.loadImages(this.imageDirectory);
			if(this.webpPath){
				await this.checkGenerateWebp(this.imageDirectory, this.webpPath);
			}
		}
	}

	private resolveWebpPaths(filePath: string, webpDirPath: string, imageDirPath: string): {urlPath: string, filePath: string} {
		let relWebpPath = Path.relative(imageDirPath, filePath) + ".webp"
		let absWebpPath = Path.resolve(webpDirPath, relWebpPath);
		let webpUrlPath = this.opts.pathController.filePathToUrlPath(absWebpPath);
		return {filePath: absWebpPath, urlPath: webpUrlPath}
	}

	private async checkGenerateWebp(imageDirPath: string, webpDirPath: string): Promise<void>{
		let webpInImg = this.opts.pathController.isPathInsidePath(webpDirPath, imageDirPath);
		let imgInWebp = this.opts.pathController.isPathInsidePath(imageDirPath, webpDirPath);
		if(webpInImg || imgInWebp){
			throw new Error(`Image directory and webp directory are nested in one another("${imageDirPath} and ${webpDirPath}"). That is not allowed.`);
		}

		let promises = [] as Promise<void>[];
		for(let baseImage of this.knownImages.values()){
			if(baseImage.format === "webp"){
				continue;
			}

			let {filePath: absWebpPath, urlPath: webpUrlPath} = this.resolveWebpPaths(baseImage.filePath, webpDirPath, imageDirPath);
			promises.push((async () => {
				try {
					let [webpStats, baseStats] = await Promise.all([
						Fs.stat(absWebpPath),
						Fs.stat(baseImage.filePath),
					]);
	
					if(webpStats.mtimeMs > baseStats.mtimeMs){
						return; // webp is old enough, no need to regenerate
					}
				} catch(e){
					if(e.code !== "ENOENT"){ // enoent = no webp file, it's something to expect
						throw e;
					}
				}

				let bytes = await this.buildWebp(baseImage);
				await writeFileAndCreateDirs(absWebpPath, bytes);
				
				let webpDescr: InternalImageInfo = {
					height: baseImage.height,
					width: baseImage.width,
					format: "webp",
					filePath: absWebpPath,
					urlPath: webpUrlPath,
					hash: this.opts.useHashes()? getFileContentHash(bytes): undefined
				}

				this.knownImages.set(webpUrlPath, webpDescr);

			})());
		}

		await Promise.all(promises);
	}

	private calculateImageSize(filePath: string): Promise<ISize>{
		return new Promise((ok, bad) => {
			try {
				ImageSize.imageSize(filePath, (err, result) => {
					if(err || !result){
						bad(err || new Error("ImageSize returned no result."));
					} else {
						ok(result);
					}
				});
			} catch(e){
				bad(e);
			}
		})
	}

	private async describeImage(filePath: string, format: string): Promise<InternalImageInfo>{
		let desc = await this.calculateImageSize(filePath);
		
		if(desc.height === undefined || desc.width === undefined){
			throw new Error("ImageSize returned empty width and/or height as result; don't know what to do (for " + filePath + ")");
		}

		let hash = this.opts.useHashes()? await getFileHash(filePath): undefined;

		return {
			width: desc.width,
			height: desc.height,
			urlPath: this.opts.pathController.filePathToUrlPath(filePath),
			filePath,
			format,
			hash
		};
	}

	private async loadImages(dirPath: string): Promise<void>{
		let images = await getFileListRecursive(dirPath);
		await Promise.all(images.map(async imageFilePath => {
			let format = extensionNoDot(imageFilePath);
			if(this.supportedImageFormats.has(format)){
				let description = await this.describeImage(imageFilePath, format);
				this.knownImages.set(description.urlPath, description);
			}
		}));
	}

	private async buildWebp(img: InternalImageInfo): Promise<Buffer>{
		let losless = img.format === "png" || img.format === "svg";
		let [result] = await Imagemin([img.filePath], {
			plugins: [ImageminWebp({
				lossless: losless,
				quality: losless? 100: 65
			})]
		});
		if(result.destinationPath){
			// ??????
			throw new Error("Do something with destination path of " + img.filePath + ": " + result.destinationPath);
		}
		return result.data;
	}

	hasContentItem(urlPath: string): boolean {
		return this.knownImages.has(urlPath);
	}

	describeContentItem(urlPath: string): Lithograph.ContentItemDescription | null {
		let desc = this.knownImages.get(urlPath);
		if(!desc){
			return null;
		}

		return {
			...desc,
			responseType: "ok",
			mime: allKnownMimeTypes[desc.format as keyof(typeof allKnownMimeTypes)] || allKnownMimeTypes.bytes
		}
	}

	protected getHash(urlPath: string): string | undefined {
		return this.knownImages.get(urlPath)?.hash;
	}

	private getImageInternal(urlPath: string): InternalImageInfo {
		let img = this.knownImages.get(urlPath);
		if(!img){
			throw new Error("Image is requested, but not found: " + urlPath);
		}

		return img;
	}

	getImageInfo(urlPath: string): Lithograph.ImageInfo {
		return this.getImageInternal(urlPath);
	}

	getImageWebpUrlPath(urlPath: string): string {
		let img = this.getImageInternal(urlPath);
		if(img.format === "webp"){
			return img.urlPath;
		}

		if(!this.imageDirectory){
			throw new Error("Webp path is requested for " + urlPath + ", but no image directory is defined, therefore there is nowhere to get base image data from.");
		}

		if(!this.webpPath){
			throw new Error("Webp path is requested for " + urlPath + ", but no webp directory is defined, therefore there is nowhere to put the webps.");
		}

		let webpPaths = this.resolveWebpPaths(img.filePath, this.webpPath, this.imageDirectory);
		return webpPaths.urlPath;
	}
	
}