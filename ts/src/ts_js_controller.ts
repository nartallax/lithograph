import {Lithograph} from "lithograph";
import {promises as Fs} from "fs";
import {Imploder} from "@nartallax/imploder";
import {extensionNoDot, getFileContentHash, getFileListRecursive, writeFileAndCreateDirs} from "lithograph_utils";
import {LithographPathController} from "path_controller";
import {LithographContentController} from "content_controller";
import {allKnownMimeTypes} from "mime";

export interface LithographTsJsControllerOptions {
	pathController: LithographPathController;
	useHashes: () => boolean;
}

interface ImploderProjectReference {
	tsconfig: string;
	profile?: string;
}


export class LithographTsJsController implements LithographContentController {

	constructor(private readonly opts: LithographTsJsControllerOptions){}
	
	private knownImploderProjects: Map<string, ImploderProjectReference> = new Map();
	private knownScriptDirectories: Set<string> = new Set();
	private knownScriptFiles: Set<string> = new Set();
	private allKnownScripts: Map<string, string | undefined> = new Map();

	addImploderProject(urlPath: string, tsconfigJsonPath: string, profile?: string){
		if(this.knownImploderProjects.has(urlPath)){
			throw new Error("Imploder project defined twice for url " + urlPath);
		}
		this.knownImploderProjects.set(urlPath, {tsconfig: tsconfigJsonPath, profile});
	}

	addScriptFile(filePath: string){
		this.knownScriptFiles.add(filePath);
	}

	addScriptDirectory(dirPath: string){
		this.knownScriptDirectories.add(dirPath);
	}

	async onResourceDefinitionCompleted(): Promise<void> {
		// collecting all registered files into allKnownScripts
		await Promise.all([...this.knownScriptDirectories].map(async dir => {
			let files = (await getFileListRecursive(dir)).filter(x => extensionNoDot(x) === "js");
			files.forEach(filePath => {
				let urlPath = this.opts.pathController.filePathToUrlPath(filePath);
				this.allKnownScripts.set(urlPath, undefined)
			});
		}));
		this.knownScriptFiles.forEach(filePath => {
			let urlPath = this.opts.pathController.filePathToUrlPath(filePath);
			this.allKnownScripts.set(urlPath, undefined)
		});
		[...this.knownImploderProjects.keys()].forEach(urlPath => {
			this.allKnownScripts.set(urlPath, undefined);
		})
	
		if(!this.opts.useHashes()){
			return;
		}

		await Promise.all([...this.allKnownScripts.keys()].map(async urlPath => {
			let code = await this.getItemContent(urlPath);
			let hash = getFileContentHash(Buffer.from(code, "utf-8"));
			this.allKnownScripts.set(urlPath, hash);
		}));
	}

	private async getImploderProjectContent(imploderProject: ImploderProjectReference): Promise<string> {
		let config = await Imploder.parseConfig(imploderProject.tsconfig, {profile: imploderProject.profile});
		if(config.watchMode){
			return await Imploder.externalInstance(config).assembleBundle();
		}

		let context = await Imploder.runFromTsconfig(imploderProject.tsconfig, {profile: imploderProject.profile});
		if(!context.compiler.lastBuildWasSuccessful){
			throw new Error("Failed to build Imploder project " + imploderProject.tsconfig);
		}
		return await Fs.readFile(context.config.outFile, "utf-8");
	}

	private async getItemContent(urlPath: string): Promise<string> {
		let imploderProject = this.knownImploderProjects.get(urlPath)
		if(imploderProject){
			return await this.getImploderProjectContent(imploderProject);
		}
		
		let filePath = this.opts.pathController.urlPathToFilePath(urlPath);
		return await Fs.readFile(filePath, "utf-8");
	}

	hasContentItem(urlPath: string): boolean {
		return this.knownScriptFiles.has(urlPath);
	}

	describeContentItem(urlPath: string): Lithograph.ContentItemDescription | null {
		if(!this.allKnownScripts.has(urlPath)){
			return null;
		}

		return {
			responseType: "ok",
			urlPath,
			mime: allKnownMimeTypes.js,
			getContent: () => this.getItemContent(urlPath),
			hash: this.allKnownScripts.get(urlPath)
		}
	}

	async onWriteAllToDisk(){
		await Promise.all([...this.knownImploderProjects.entries()].map(async ([urlPath, proj]) => {
			let code = await this.getImploderProjectContent(proj);
			let filePath = this.opts.pathController.urlPathToFilePath(urlPath);
			await writeFileAndCreateDirs(filePath, code);
		}))
	}
	
}