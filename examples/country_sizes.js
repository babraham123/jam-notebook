import area from '@turf/area';

async function fetchJSON(...args) {
  const res = await fetch(...args);
  return await res.json();
}

const countries = await fetchJSON('https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_0_countries.geojson');

const sizes = await countries.features.map(feat => {
  return {
    admin: feat.properties.admin,
    size: area(feat)
  }
});
