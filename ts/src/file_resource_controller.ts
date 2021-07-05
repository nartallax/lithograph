import {extensionNoDot, getFileHash, getFileListRecursive} from "lithograph_utils";
import {LithographPathController} from "path_controller";
import {LithographContentController} from "content_controller";
import {Lithograph} from "lithograph";
import {allKnownMimeTypes} from "mime";

export interface LithographFileResourceControllerOptions {
	pathController: LithographPathController;
	useHashes: () => boolean;
}

/** Controller for just some generic files we make no assumptions about */
export class LithographFileResourceController implements LithographContentController {

	private readonly knownFiles = new Map<string, string | undefined>();
	private readonly resourceDirectories: string[] = [];
	private readonly filesToLoad: string[] = [];

	constructor(private readonly opts: LithographFileResourceControllerOptions){}

	hasContentItem(urlPath: string): boolean {
		return this.knownFiles.has(urlPath);
	}

	describeContentItem(urlPath: string): Lithograph.ContentItemDescription | null {
		if(!this.knownFiles.has(urlPath)){
			return null;
		}

		let filePath = this.opts.pathController.urlPathToFilePath(urlPath);
		let ext = extensionNoDot(filePath);
		let mime = ext in allKnownMimeTypes? (allKnownMimeTypes as any)[ext] as string: allKnownMimeTypes.bytes;

		return {
			urlPath,
			filePath,
			mime,
			responseType: "ok",
			hash: this.knownFiles.get(urlPath)
		}
	}

	addFile(filePath: string): void {
		this.filesToLoad.push(filePath);
	}

	addDirectory(dirPath: string): void {
		this.resourceDirectories.push(dirPath);
	}

	async onResourceDefinitionCompleted(): Promise<void> {
		let promises = [] as Promise<void>[];

		this.resourceDirectories.forEach(dirPath => {
			promises.push((async () => {
				let files = await getFileListRecursive(dirPath);
				await Promise.all(files.map(filePath => this.loadFile(filePath)))
			})())
		});

		this.filesToLoad.forEach(filePath => {
			promises.push(this.loadFile(filePath));
		});
		
		await Promise.all<void>(promises);
	}

	private async loadFile(filePath: string): Promise<void> {
		let urlPath = this.opts.pathController.filePathToUrlPath(filePath);
		let hash = this.opts.useHashes()? await getFileHash(filePath): undefined;
		this.knownFiles.set(urlPath, hash);
	}

}