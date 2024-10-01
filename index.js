main()
events()
async function main() {
	let data = getData()
	const mapOpts = {
	}
	const map = L.map('map', mapOpts).setView([-37.815,144.98], 17)
	map.locate({setView: true, maxZoom: 17})
	map.on('locationerror', onLocationError)
	L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
		accessToken: 'sk.eyJ1Ijoic2xvcHB5Y2lzbSIsImEiOiJjazRrMGVuODMwMmN5M2p0YXlxejZ0a2FoIn0.Gr1qHzFgUPMh6J6ZvFpAWg',
		attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>, Tap data scraped from <a href="https://choosetap.com.au/">ChooseTap</a>, Original scraper and viewer by <a href="https://github.com/brdrcol/choosetap-viewer">Andrew P</a>',
		maxZoom: 19,
		id: 'mapbox/streets-v11'
	}).addTo(map)
	try {
		data = await data
		console.log(`Data file created ${new Date(Date.parse(data.ts)).toLocaleString()}`)
		addMarkers(map, data.taps)
	} catch (err) {
		console.error('failure', err)
	}
}

function events() {
	const rmHeader = document.getElementById('rm-header')
	const header = rmHeader.parentNode
	rmHeader.addEventListener('click', () => header.parentNode.removeChild(header))
}

async function getData() {
	const response = await fetch('taps.json')
	const data = response.json()
	return data
}

function addMarkers(map, taps) {
	const markers = L.markerClusterGroup({
		disableClusteringAtZoom: 8
	})
	for (const tap of taps) {
		const marker = L.marker(tap.loc)//.addTo(map)
		if (tap.tags) {
			marker.bindPopup(`${tap.desc} tagged: ${tap.tags.join(', ')}`)
		} else {
			marker.bindPopup(tap.desc)
		}
		markers.addLayer(marker)
	}
	map.addLayer(markers)
}

function onLocationError(e) {
	console.log(`Unable to get user location: ${e.message}`);
}
