const { queryNodes } = figma.notebook;

const stickies = await queryNodes("section > sticky");
export const tasks = [];

for (const sticky of stickies) {
  tasks.push({
    name: sticky.name,
    section: sticky.parent.name,
    priority: sticky.stuckNodes.length, // TODO: fix this
  });
}

const toDos = tasks.filter(t => t.priority > 2)