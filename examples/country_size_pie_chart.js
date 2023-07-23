const countrySizes;
const PieChart;

const plot = PieChart(countrySizes, {
  name: d => d.admin,
  value: d => d.size,
  title: d => {
    if (d.size < 900000000000) return ""
    return d.admin
  },
  width: 1000,
  height: 1000
  }
)