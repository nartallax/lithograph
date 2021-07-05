import {Lithograph} from "lithograph";
import {PrefixTree} from "prefix_tree";
import {UrlPatternIterator} from "url_pattern_iterator";

export class UrlPathPatternMatcher<K extends {[k: string]: string[]}> implements Iterable<string> {
	private readonly parts: ReadonlyArray<(string | {name: keyof K, tree: PrefixTree})>;

	constructor(private readonly opts: Lithograph.UrlPatternDefinition<K>){
		this.parts = opts.pathPattern.map(part => {
			if(typeof(part) === "string"){
				return part;
			} else {
				let tree = new PrefixTree(opts.valueLists[part.name]);
				return {tree, name: part.name};
			}
		})
	}

	[Symbol.iterator](): IterableIterator<string>{
		return new UrlPatternIterator(this.opts);
	}

	match(urlPath: string): Lithograph.UrlPatternMatchingResult<K> | null {
		let position = 0;
		let result: Partial<Lithograph.UrlPatternMatchingResult<K>> = {};
		for(let i = 0; i < this.parts.length; i++){
			let part = this.parts[i];
			if(typeof(part) === "string"){
				if(urlPath.substr(position, part.length) !== part){
					return null;
				}
				position += part.length;
			} else {
				let matchResult = part.tree.match(urlPath, position);
				if(!matchResult){
					return null;
				}
				result[part.name] = matchResult as Lithograph.ArrValueType<K[typeof part.name]>;
				position += matchResult.length;
			}
		}

		if(position < urlPath.length){
			return null; // did not reached end of path
		}

		return result as Lithograph.UrlPatternMatchingResult<K>;
	}

	matchOrThrow(urlPath: string): Lithograph.UrlPatternMatchingResult<K> {
		let result = this.match(urlPath);
		if(result === null){
			throw new Error(`Failed to match on url ${urlPath} (pattern is ${JSON.stringify(this.parts)})`);
		}
		return result;
	}

}