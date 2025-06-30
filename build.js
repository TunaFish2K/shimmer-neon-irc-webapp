import { readFile, writeFile } from "fs/promises";

async function build() {
    await writeFile("./_assets.json", JSON.stringify(JSON.parse(await readFile("./sea-config.json", "utf-8")).assets));
}

build();