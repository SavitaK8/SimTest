document.addEventListener('DOMContentLoaded', () => {
  const data = window.SIMTEST_DATA;
  if (!data) return;

  // 1. Populate Sidebar Stats
  document.getElementById('meta-target').textContent = data.targetUrl;
  document.getElementById('meta-time').textContent = new Date(data.timestamp).toLocaleString();
  document.getElementById('meta-duration').textContent = `${(data.stats.duration / 1000).toFixed(1)}s`;

  document.getElementById('stat-states').textContent = data.stats.totalStates;
  document.getElementById('stat-transitions').textContent = data.stats.totalTransitions;
  document.getElementById('stat-depth').textContent = data.stats.explorationDepth;

  let highCount = 0, medCount = 0, lowCount = 0;
  data.bugs.forEach(b => {
    if (b.severity === 'high') highCount++;
    else if (b.severity === 'medium') medCount++;
    else lowCount++;
  });
  document.getElementById('stat-high').textContent = highCount;
  document.getElementById('stat-medium').textContent = medCount;
  document.getElementById('stat-low').textContent = lowCount;
  document.getElementById('nav-bug-count').textContent = data.bugs.length;

  // 2. Tab Navigation
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navItems.forEach(n => n.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      
      item.classList.add('active');
      document.getElementById(`tab-${item.dataset.tab}`).classList.add('active');
    });
  });

  // 3. Populate States Table
  const statesTbody = document.getElementById('states-tbody');
  data.graph.nodes.forEach(node => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="mono text-muted">${node.id.substring(0, 8)}</td>
      <td class="mono">${node.url}</td>
      <td>${node.explored ? 'Yes' : '<span class="text-muted">No</span>'}</td>
      <td>${node.hasBug ? '<span class="badge badge-high">BUG</span>' : '-'}</td>
    `;
    statesTbody.appendChild(tr);
  });

  // 4. Populate Transitions Table
  const transitionsTbody = document.getElementById('transitions-tbody');
  data.graph.edges.forEach(edge => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="mono text-muted">${edge.from.substring(0, 8)}</td>
      <td class="mono">${edge.action}</td>
      <td class="mono text-muted">${edge.to.substring(0, 8)}</td>
    `;
    transitionsTbody.appendChild(tr);
  });

  // 5. Populate Bugs Table
  const bugsTbody = document.getElementById('bugs-tbody');
  data.bugs.forEach((bug, index) => {
    const tr = document.createElement('tr');
    tr.className = 'clickable-row';
    tr.innerHTML = `
      <td class="mono">${bug.id}</td>
      <td><span class="badge badge-${bug.severity}">${bug.severity.toUpperCase()}</span></td>
      <td class="mono text-muted">${bug.type}</td>
      <td>${bug.description}</td>
      <td class="mono text-muted">${bug.state.url}</td>
    `;
    
    const detailTr = document.createElement('tr');
    detailTr.className = 'bug-detail-row';
    detailTr.style.display = 'none';
    detailTr.innerHTML = `
      <td colspan="5">
        <div class="bug-detail-container">
          <div class="bug-detail-section">
            <h4>Action Leading to Bug</h4>
            <div class="code-block">${JSON.stringify(bug.action, null, 2)}</div>
          </div>
          <div class="bug-detail-section">
            <h4>Evidence Recorded</h4>
            <div class="code-block">${bug.evidence.errors.length > 0 ? bug.evidence.errors.join('\\n') : 'No stack trace captured.'}</div>
          </div>
        </div>
      </td>
    `;

    tr.addEventListener('click', () => {
      const isVisible = detailTr.style.display !== 'none';
      detailTr.style.display = isVisible ? 'none' : 'table-row';
    });

    bugsTbody.appendChild(tr);
    bugsTbody.appendChild(detailTr);
  });
});
