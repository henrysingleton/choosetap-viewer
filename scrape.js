const jsonFileName = 'taps.json'
const domainPrefix = 'https://choosetap.com.au' // Prepended to the script path we extract.
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
		for (const key of ['name', 'location']) {
			tap[key] = tap[key].trim()
			if (tap[key].endsWith('\\n')) {
				tap[key] = tap[key].replace(/\\n/g, '')
			}
			tap[key] = tap[key].replace(/\\n/g, ', ')
		}
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
		if (tap.tags && tap.tags.length) {
			out.tags = tap.tags
		}
		if (tap.tags && tap.tags[0] === 5 && tap.tags.length === 1) {
			console.log('Dropping cafe', tap)
			continue
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
	const htmlContent = response.body.toString('utf8')

	// We assume the script we want will have "component---src-pages-tap-finder-index-tsx-" in its path.
	const regex = /<script\s+[^>]*src="(\/component---src-pages-tap-finder-index-tsx-[^"]+)"[^>]*>/;
	const match = htmlContent.match(regex);
	if (match) {
		// Find the first script tag that matches and return it, prefixed with the site domain.
		console.log('Found script src:', match[1]); // Output: /component---src-pages-tap-finder-index-tsx-471b14ae8f91333ecbf7.js
		return domainPrefix + match[1]
	} else {
		console.log('No match found.');
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
