function waitForInteractive(): Promise<void>{
	return new Promise(ok => {
		
		function check(){
			if(document.readyState === "interactive"){
				ok();
			}
		}

		document.addEventListener("readystatechange", check)
		check();
	});
}

export async function main(): Promise<void> {
	console.log("yay i'm working!");	
	await waitForInteractive();
	let h1 = document.createElement("h1");
	h1.textContent = "=^_^="
	document.body.appendChild(h1);
}