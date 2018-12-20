# audit-bot
                
[![Known Vulnerabilities](https://snyk.io/test/github/ekdevdes/audit-bot/badge.svg?targetFile=package.json)](https://snyk.io/test/github/ekdevdes/audit-bot?targetFile=package.json)

A command line tool that allows to run Google Lighthouse and Mozilla Observatory tests for security, best practices, SEO, PWA compliance, and accesibility on local and public urls

### Options

#### --verbose, -v
Output detailed logs of the current stage of the lighthouse test

#### --test=[lighthouse|observatory], -t [lighthouse|observatory]
`--test=lighthouse` will only run the lighthouse test and not the mozilla observatory security test and `--test=observatory` will only run the mozilla observatory security test

#### --help
Shows the help documentation for this command

#### --version
Outputs the version number of currently installed version of the command (latest is 1.0.0)

## The License

&copy; Copyright 2017 Ethan Kramer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
