otlib.pyplot as plt
import io

fig, ax = plt.subplots()
ax.plot([1,3,2])

buf = io.BytesIO()
fig.savefig(buf, format='svg')
buf.seek(0)

# 'image/svg+xml;charset=utf-8'
const svg_str = buf.read().decode('UTF-8')
# buf.close()
