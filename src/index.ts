import * as commander from "commander";

import figlet from "figlet";
import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import shell from "shelljs";
import fs from "fs-extra";
import path from "path"

const nowPath = process.cwd();
const packageInfo = require(path.resolve(__dirname, "../../package.json"));
const program = new commander.Command();

program
  .version(packageInfo.version, "-v, --version")
  .usage("[options]")
  .option("-d --dir <dir>", "目录");

program.parse(process.argv);

console.log(chalk.green(figlet.textSync("TangWei")));
