#!/usr/bin/env node
// rp/server — serve plan.html from a directory, block until POST /submit,
// write submission.json next to plan.html, exit.
//
// Usage: node server.mjs <port> <dir>
//        port 0 = OS picks a free port

import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { extname, join, resolve, sep } from 'node:path'
import { spawn } from 'node:child_process'

const [, , portArg, dirArg] = process.argv
if (!portArg || !dirArg) {
	console.error('usage: server.mjs <port> <dir>')
	console.error('       port 0 = OS picks a free port')
	process.exit(2)
}

const port = Number(portArg)
const dir = resolve(dirArg)
const planPath = join(dir, 'plan.html')
const submissionPath = join(dir, 'submission.json')
const urlPath = join(dir, '.rp-url')

const cleanup = () => {
	try {
		unlinkSync(urlPath)
	} catch {}
}

if (!existsSync(planPath)) {
	console.error(`rp: ${planPath} not found`)
	process.exit(1)
}

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'application/javascript; charset=utf-8',
	'.mjs': 'application/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
	'.woff2': 'font/woff2',
}

const server = createServer((req, res) => {
	const url = new URL(req.url, `http://${req.headers.host}`)
	const pathname = url.pathname

	if (req.method === 'POST' && pathname === '/submit') {
		const chunks = []
		req.on('data', (c) => chunks.push(c))
		req.on('end', () => {
			const body = Buffer.concat(chunks)
			writeFileSync(submissionPath, body)
			res.writeHead(200, { 'Content-Type': 'application/json' })
			res.end('{"ok":true}')
			console.error(`rp: submission → ${submissionPath}`)
			setTimeout(() => {
				cleanup()
				server.close(() => process.exit(0))
			}, 80)
		})
		return
	}

	if (req.method !== 'GET') {
		res.writeHead(404).end('not found')
		return
	}

	let filePath
	if (pathname === '/' || pathname === '/plan.html') {
		filePath = planPath
	} else {
		const safe = pathname.replace(/^\/+/, '')
		const candidate = resolve(dir, safe)
		if (candidate !== dir && !candidate.startsWith(dir + sep)) {
			res.writeHead(404).end('not found')
			return
		}
		filePath = candidate
	}

	if (existsSync(filePath) && statSync(filePath).isFile()) {
		const mime = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream'
		res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' })
		res.end(readFileSync(filePath))
		return
	}

	res.writeHead(404).end('not found')
})

server.on('error', (err) => {
	if (err.code === 'EADDRINUSE') {
		console.error(`rp: port ${port} is already in use`)
		console.error(`rp: another rp may be running — kill it, or pass --port <N> / RP_PORT=<N>`)
		process.exit(3)
	}
	console.error(`rp: server error: ${err.message}`)
	process.exit(1)
})

server.listen(port, '127.0.0.1', () => {
	const actualPort = server.address().port
	const url = `http://127.0.0.1:${actualPort}/`
	// Both stdout (parseable) and stderr (visible in logs), plus a sidecar file
	// for callers that prefer reading the URL from disk.
	console.log(url)
	console.error(`rp: serving ${planPath}`)
	console.error(`rp: open ${url}`)
	try {
		writeFileSync(urlPath, url + '\n')
	} catch {}
	if (!process.env.RP_NO_OPEN) {
		const opener =
			process.platform === 'darwin'
				? 'open'
				: process.platform === 'win32'
					? 'start'
					: 'xdg-open'
		spawn(opener, [url], { stdio: 'ignore', detached: true }).unref()
	}
})

process.on('SIGINT', () => {
	console.error('rp: interrupted')
	cleanup()
	process.exit(130)
})
