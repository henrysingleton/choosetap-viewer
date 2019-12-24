const jsonFileName = 'taps.json'
main()

async function main() {
	try {
		let taps
		console.log('Downloading index')
		const bundleURL = await findBundleURL()
		console.log(`Downloading ${bundleURL}`)
		const response = await get(bundleURL)
		console.log(`Bundle is ${Math.round(response.body.length / 1024)}KiB`)
		const bundle = response.body.toString('utf8')
		taps = findTapsInBundle(bundle)
		taps = optimiseTaps(taps)
		console.log(`Found ${taps.taps.length} taps`)
		require('fs').writeFileSync(jsonFileName, JSON.stringify(taps), 'utf8')
	} catch (err) {
		console.error('Something went wrong', err)
	}
}

function optimiseTaps(taps) {
	let arr = []
	for (const tap of taps) {
		tap.name = tap.name.trim()
		tap.location = tap.location.trim()
		const lowerLocation = tap.location.toLowerCase()
		const lowerName = tap.name.toLowerCase()
		if (lowerLocation.includes('address')) {
			tap.location = undefined
		}
		const out = {
			loc: [tap.latitude, tap.longitude],
			//tags: tap.tags,
			desc: undefined
		}
		if (tap['Merged_P_4']) {
			out.desc = tap['Merged_P_4'].trim()
		} else if (tap.location && tap.name) {
			// Use both or the longest but don't double up
			if (lowerLocation.includes(lowerName)) {
				out.desc = tap.location
			} else if (lowerName.includes(lowerLocation)) {
				out.desc = tap.name
			} else {
				out.desc = `${tap.name}<br>${tap.location}`
			}
		} else {
			out.desc = tap.name
		}
		if (tap.date_created) {
			out.desc = `${out.desc}<br>${tap.date_created}`
		}
		arr.push(out)
	}
	return {
		ts: (new Date()).toISOString(),
		taps: arr
	}
}

async function findBundleURL() {
	// Download full HTML
	const response = await get('https://choosetap.com.au/tap-finder/')
	const html = response.body.toString('utf8')

	// Extract URL of javascript bundle
	const matches = html.split('<')
	// Iterate backwards through tags, wanted script is near end of page
	let i = matches.length
	while(i--) {
		const element = matches[i]
		// Skip closing tags
		if (element[0] === '/') {
			continue
		}
		// Reject non-script elements
		if (element.substr(0,7).toLowerCase() !== 'script ') {
			continue
		}
		// Parse <script src="" >
		const bundleURL = element.match(/.*src=['"](.*)['"]/i)[1]
		if (bundleURL) {
			return bundleURL
		}
	}
	throw new Error('Unable to extract a bundle URL from a script element')
}

function findTapsInBundle(bundle) {
	const chunks = bundle.split('e.exports=')
	let data
	const intro = `JSON.parse('[`
	// Iterate backwards, the wanted export is top-level code so will be near the end
	let i = chunks.length
	while (i--) {
		try {
			const chunk = chunks[i]
			if (!chunk.startsWith(intro)) {
				continue
			}
			const jsonStart = intro.length - 1
			const jsonEnd = chunk.lastIndexOf(`]')}`) + 1
			data = chunk.substring(jsonStart, jsonEnd)
			// Escaped apostrophes choke the JSON.parse
			data = data.replace(/\\'/g, `'`)
			data = JSON.parse(data)
			if (data.length > 1000) {
				const record = data[0]
				// Check format is as expected
				if (record.latitude && record.longitude && record.location) {
					return data
				}
			}
	} catch (err) {
		console.error('Failed to process', err)
	}
}
throw new Error('Failed to find suitable JSON data in bundle')
}

/*
 * HTTPS/HTTP GET method promise wrapper with basic response concat
 */
function get(options) {
	let http = require('https')
	if (options.protocol === 'http:') {
		http = require('http')
	}
	let resolve, reject
	const promise = new Promise((res, rej) => {
		resolve = res
		reject = rej
	})
	const req = http.get(options, res => {
		// Reject on status code
		if (res.statusCode < 200 || res.statusCode > 299) {
			reject(res)
		}
		// Handle response building
		const chunks = []
		res.on('data', data => chunks.push(data))
		res.on('end', () => {
			const body = Buffer.concat(chunks)
			res.body = body
			resolve(res)
		})
	})
	// Reject on request errors
	req.on('error', reject)
	return promise
}
