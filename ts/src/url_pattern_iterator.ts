import {Lithograph} from "lithograph";

export class UrlPatternIterator<K extends {[k: string]: string[]}> implements IterableIterator<string> {
	// TODO: optimise here?
	// probably could cache parts of urls at least

	private readonly constParts: ReadonlyArray<string>;
	private readonly dynParts: ReadonlyArray<ReadonlyArray<string>>;
	private readonly indices: number[];
	private finished = false;

	constructor(def: Lithograph.UrlPatternDefinition<K>){
		if(def.pathPattern.length === 0){
			// empty patterns yield empty iteration results
			this.finished = true;
		}

		let consts = [""] as string[];
		let dyns = [] as string[][];

		// after this transform consts have exactly dyns + 1 element
		for(let part of def.pathPattern){
			if(typeof(part) === "string"){
				consts[consts.length - 1] += part;
			} else {
				dyns.push(def.valueLists[part.name]);
				consts.push("");
			}
		}

		this.constParts = consts;
		this.dynParts = dyns;
		this.indices = dyns.map(() => 0);
	}

	[Symbol.iterator](): IterableIterator<string>{
		return this; // it's allright: https://basarat.gitbook.io/typescript/future-javascript/iterators
	}

	next(): IteratorResult<string, undefined> {
		if(this.finished){
			return {done: true, value: undefined}
		}

		let result = "";
		for(let i = 0; i < this.dynParts.length; i++){
			result += this.constParts[i];
			result += this.dynParts[i][this.indices[i]];
		}
		result += this.constParts[this.constParts.length - 1];

		this.increment();
		
		return {done: false, value: result}
	}

	private increment(){
		let partNum = this.dynParts.length - 1;
		while(partNum >= 0){
			if(this.indices[partNum] < this.dynParts[partNum].length - 1){
				this.indices[partNum]++;
				return;
			} else {
				this.indices[partNum] = 0;
				partNum--;
			}
		}
		this.finished = true;
	}

}