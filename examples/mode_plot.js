/*
 * Run this query in Mode:
 *
 * SELECT species, COUNT(species) FROM tutorial.animal_crossing_villagers GROUP BY species;
 * 
 */

import * as Plot from '@observablehq/plot';
import { getQueryResult } from "Mode";

const data = await getQueryResult("123abc", "xyz789");

const svg = Plot.plot({
  marginLeft: 200,
  x: {
    grid: true
  },
  marks: [
    Plot.barX(data, {
      x: "species",
      y: "count",
      fill: "count"
    })
  ]
});
