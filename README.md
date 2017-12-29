# audit-cmd
A command line tool that allows to run Google Lighthouse and Mozilla Observatory tests for security, best practices, SEO, PWA compliance, and accesibility on local and public urls

## Installation

`npm i -g audit-cli`

## Usage
*&lt;url&gt;* is required, options are....well, optional.<br><br>

<pre>
report &lt;url&gt; [options]
</pre>
Runs both a Google Lighthouse and Mozilla Observatory Security report<br><br>

<pre>
report http://localhost:3030 --verbose
</pre>
Runs both a Google Lighthouse and Mozilla Observatory Security report using verbose output for lighthouse<br><br>

<pre>
report http://google.com
</pre>
Runs only a Google Lighthouse report using verbose output for lighthouse<br><br>

<pre>
report http://localhost:8888 --verbose --only=lighthouse
</pre>
Runs only a Google Lighthouse report using verbose output for lighthouse<br><br>

<pre>
report http://instagram.com --only=observatory
</pre>
Runs only a Mozilla Observatory Security report<br><br>

<pre>
report http://example.localhost.com:3000 --only=lighthouse
</pre>
Runs only a Google Lighthouse report<br><br>

### Options

#### --verbose
Output detailed logs of the current stage of the lighthouse test

#### --only=[lighthouse|observatory]
`--only=lighthouse` will only run the lighthouse test and not the mozilla observatory security test and `--only=observatory` will only run the mozilla observatory security test

#### --help
Shows the help documentation for this command

#### --version
Outputs the version number of currently installed version of the command (latest is 1.0.0)

## The License

&copy; Copyright 2017 Ethan Kramer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
