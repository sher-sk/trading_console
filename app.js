let tableData = [], sortCol = 'date', sortAsc = false;
const s = id => document.getElementById(id);
const q = sel => document.querySelectorAll(sel);

const tableBody = s('table-body'), myPnlEl = s('my-total-pnl'), gPnlEl = s('guriji-total-pnl');
const heatmapContainer = s('heatmap-container'), themeToggle = s('theme-toggle');

// ── Column definitions ────────────────────────────────────────────────────────
// Each column: { id, label, sort (key or null), render(row) → html string }
let columns = [
    {
        id: 'date', label: 'Date', sort: 'date',
        render: r => r.date || '-'
    },
    {
        id: 'day', label: 'Day', sort: null,
        render: r => `<span style="color:var(--text-secondary);font-weight:600">${getDay(r.date)}</span>`
    },
    {
        id: 'entryTime', label: 'Entry', sort: 'entryTime',
        render: r => r.entryTime || '-'
    },
    {
        id: 'exitTime', label: 'Exit', sort: 'exitTime',
        render: r => r.exitTime || '-'
    },
    {
        id: 'capitalUsed', label: 'Capital', sort: 'capitalUsed',
        render: r => formatLakhs(r.capitalUsed)
    },
    {
        id: 'direction', label: 'Dir', sort: 'direction',
        render: r => `<span class="direction-badge direction-${(r.direction||'').toLowerCase()}">${r.direction||'-'}</span>`
    },
    {
        id: 'pnl', label: 'My P/L', sort: 'pnl',
        render: r => `<span class="${r.pnl>0?'positive':r.pnl<0?'negative':''}">${formatLakhs(r.pnl)}</span>`
    },
    {
        id: 'guriji.pnl', label: 'G. P/L', sort: 'guriji.pnl',
        render: r => `<span class="${r.guriji?.pnl>0?'positive':r.guriji?.pnl<0?'negative':''}">${r.guriji?.pnl!=null?r.guriji.pnl:'-'}</span>`
    },
    {
        id: 'guriji.direction', label: 'G. Dir', sort: 'guriji.direction',
        render: r => r.guriji?.direction
            ? `<span class="direction-badge direction-${r.guriji.direction.toLowerCase()}">${r.guriji.direction}</span>`
            : '-'
    },
    {
        id: 'guriji.entryTime', label: 'G. Entry', sort: 'guriji.entryTime',
        render: r => r.guriji?.entryTime || '-'
    },
    {
        id: 'guriji.exitTime', label: 'G. Exit', sort: 'guriji.exitTime',
        render: r => r.guriji?.exitTime || '-'
    },
    {
        id: 'rating.plan', label: 'Plan', sort: 'rating.plan',
        render: r => renderStars(r.rating?.plan)
    },
    {
        id: 'rating.entry', label: 'Entry', sort: 'rating.entry',
        render: r => renderStars(r.rating?.entry)
    },
    {
        id: 'rating.exit', label: 'Exit', sort: 'rating.exit',
        render: r => renderStars(r.rating?.exit)
    },
];

// ── Theme toggle ──────────────────────────────────────────────────────────────
themeToggle.onclick = () => {
    document.body.classList.toggle('light-theme');
    themeToggle.textContent = document.body.classList.contains('light-theme') ? '☀️' : '🌙';
};

// ── File import ───────────────────────────────────────────────────────────────
s('import-btn').onclick = () => s('file-import').click();
s('file-import').onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = ev => {
        try { tableData = JSON.parse(ev.target.result); updateView(); }
        catch { alert('Invalid JSON'); }
    };
    r.readAsText(file);
};

// ── Formatters ────────────────────────────────────────────────────────────────
const formatLakhs = v => v == null ? '-' : (v / 100000).toFixed(2);
const formatPts   = v => v == null ? '-' : Number(v).toFixed(2);
const formatInr   = v => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v);

function getDay(dateStr) {
    if (!dateStr) return '-';
    return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(dateStr).getUTCDay()] || '-';
}

const renderStars = r => {
    const v = parseInt(r);
    return v > 0
        ? Array.from({length:3}, (_,i) => `<span class="star ${i < v ? 'filled' : ''}">★</span>`).join('')
        : '-';
};

// ── Drag-and-drop state ───────────────────────────────────────────────────────
let dragSrcIndex = null;

function buildThead() {
    const thead = document.querySelector('#data-table thead');
    const tr = document.createElement('tr');

    columns.forEach((col, idx) => {
        const th = document.createElement('th');
        th.draggable = true;
        th.dataset.colIndex = idx;
        if (col.sort) th.dataset.sort = col.sort;

        // Sort indicator
        let indicator = '-';
        if (col.sort) {
            indicator = col.sort === sortCol ? (sortAsc ? '↑' : '↓') : '↕';
        }
        th.innerHTML = `${col.label} <span>${indicator}</span>`;

        // Sort click (only on non-drag release)
        if (col.sort) {
            th.addEventListener('click', () => {
                sortAsc = sortCol === col.sort ? !sortAsc : false;
                sortCol = col.sort;
                updateView();
            });
        }

        // Drag events
        th.addEventListener('dragstart', e => {
            dragSrcIndex = idx;
            th.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        th.addEventListener('dragend', () => {
            th.classList.remove('dragging');
            document.querySelectorAll('th.drag-over').forEach(el => el.classList.remove('drag-over'));
        });

        th.addEventListener('dragover', e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            document.querySelectorAll('th.drag-over').forEach(el => el.classList.remove('drag-over'));
            if (dragSrcIndex !== idx) th.classList.add('drag-over');
        });

        th.addEventListener('dragleave', () => th.classList.remove('drag-over'));

        th.addEventListener('drop', e => {
            e.preventDefault();
            th.classList.remove('drag-over');
            if (dragSrcIndex === null || dragSrcIndex === idx) return;

            // Reorder columns array
            const moved = columns.splice(dragSrcIndex, 1)[0];
            columns.splice(idx, 0, moved);
            dragSrcIndex = null;
            updateView();
        });

        tr.appendChild(th);
    });

    thead.innerHTML = '';
    thead.appendChild(tr);
}

// ── Heatmap ───────────────────────────────────────────────────────────────────
function renderHeatmap(a) {
    if (!tableData.length) { heatmapContainer.innerHTML = ''; return; }

    let dates = tableData.map(d => new Date(d.date).getTime()).filter(x => !isNaN(x));
    if (!dates.length) return;

    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));

    let current  = new Date(Date.UTC(minDate.getUTCFullYear(), minDate.getUTCMonth(), 1));
    const endMonth = new Date(Date.UTC(maxDate.getUTCFullYear(), maxDate.getUTCMonth(), 1));

    const pnlMap = {};
    let maxProfit = 0, maxLoss = 0;

    let html = `<div class="heatmap-wrapper">`;

    if (a==="guruji") {
        tableData.forEach(r => {
            if (!r.date || typeof r.guriji.pnl !== 'number') return;
            pnlMap[r.date] = r.guriji.pnl;
            if (r.guriji.pnl > maxProfit) maxProfit = r.guriji.pnl;
            if (r.guriji.pnl < maxLoss)   maxLoss   = r.guriji.pnl;
        });


        while (current <= endMonth) {
            const year  = current.getUTCFullYear();
            const month = current.getUTCMonth();
            const monthLabel = current.toLocaleString('default', { month: 'short', timeZone: 'UTC' }) + ' ' + year.toString().slice(2);

            let monthPnl = 0, tradeCount = 0, cellsHtml = '';
            let firstDay = new Date(Date.UTC(year, month, 1));
            let cursor   = new Date(firstDay);
            const dow    = cursor.getUTCDay();
            cursor.setUTCDate(cursor.getUTCDate() + (dow === 0 ? -6 : 1 - dow));

            while (true) {
                for (let i = 0; i < 5; i++) {
                    if (cursor.getUTCMonth() === month) {
                        const dStr = cursor.toISOString().split('T')[0];
                        const pnl  = pnlMap[dStr];
                        let bgStyle = '';
                        if (pnl !== undefined) {
                            monthPnl += pnl; tradeCount++;
                            if      (pnl > 0) bgStyle = `background: rgba(16, 185, 129, ${Math.max(0.3, pnl / (maxProfit || 1))});`;
                            else if (pnl < 0) bgStyle = `background: rgba(239, 68, 68, ${Math.max(0.3, pnl / (maxLoss || -1))});`;
                            else              bgStyle = `background: var(--heatmap-empty);`;
                        }
                        const tooltip = pnl !== undefined ? `${dStr} | PnL: ${formatInr(pnl)}` : `${dStr} | No Trades`;
                        cellsHtml += `<div class="heatmap-cell" style="${bgStyle}" data-tooltip="${tooltip}"></div>`;
                    } else {
                        cellsHtml += `<div class="heatmap-cell empty"></div>`;
                    }
                    cursor.setUTCDate(cursor.getUTCDate() + 1);
                }
                cursor.setUTCDate(cursor.getUTCDate() + 2);
                if (cursor.getUTCMonth() !== month && cursor > firstDay) break;
            }

            const divClass = monthPnl > 0 ? 'positive' : monthPnl < 0 ? 'negative' : '';
            html += `
                <div class="month-block">
                    <div class="month-header">${monthLabel} (${tradeCount} trades)</div>
                    <div class="month-divider ${divClass}"></div>
                    <div class="month-grid">${cellsHtml}</div>
                    <div class="month-footer ${divClass}">${formatInr(monthPnl)}</div>
                </div>`;

            current.setUTCMonth(current.getUTCMonth() + 1);
        }
    }else{
        tableData.forEach(r => {
            if (!r.date || typeof r.pnl !== 'number') return;
            pnlMap[r.date] = r.pnl;
            if (r.pnl > maxProfit) maxProfit = r.pnl;
            if (r.pnl < maxLoss)   maxLoss   = r.pnl;
        });


        while (current <= endMonth) {
            const year  = current.getUTCFullYear();
            const month = current.getUTCMonth();
            const monthLabel = current.toLocaleString('default', { month: 'short', timeZone: 'UTC' }) + ' ' + year.toString().slice(2);

            let monthPnl = 0, tradeCount = 0, cellsHtml = '';
            let firstDay = new Date(Date.UTC(year, month, 1));
            let cursor   = new Date(firstDay);
            const dow    = cursor.getUTCDay();
            cursor.setUTCDate(cursor.getUTCDate() + (dow === 0 ? -6 : 1 - dow));

            while (true) {
                for (let i = 0; i < 5; i++) {
                    if (cursor.getUTCMonth() === month) {
                        const dStr = cursor.toISOString().split('T')[0];
                        const pnl  = pnlMap[dStr];
                        let bgStyle = '';
                        if (pnl !== undefined) {
                            monthPnl += pnl; tradeCount++;
                            if      (pnl > 0) bgStyle = `background: rgba(16, 185, 129, ${Math.max(0.3, pnl / (maxProfit || 1))});`;
                            else if (pnl < 0) bgStyle = `background: rgba(239, 68, 68, ${Math.max(0.3, pnl / (maxLoss || -1))});`;
                            else              bgStyle = `background: var(--heatmap-empty);`;
                        }
                        const tooltip = pnl !== undefined ? `${dStr} | PnL: ${formatInr(pnl)}` : `${dStr} | No Trades`;
                        cellsHtml += `<div class="heatmap-cell" style="${bgStyle}" data-tooltip="${tooltip}"></div>`;
                    } else {
                        cellsHtml += `<div class="heatmap-cell empty"></div>`;
                    }
                    cursor.setUTCDate(cursor.getUTCDate() + 1);
                }
                cursor.setUTCDate(cursor.getUTCDate() + 2);
                if (cursor.getUTCMonth() !== month && cursor > firstDay) break;
            }

            const divClass = monthPnl > 0 ? 'positive' : monthPnl < 0 ? 'negative' : '';
            html += `
                <div class="month-block">
                    <div class="month-header">${monthLabel} (${tradeCount} trades)</div>
                    <div class="month-divider ${divClass}"></div>
                    <div class="month-grid">${cellsHtml}</div>
                    <div class="month-footer ${divClass}">${formatInr(monthPnl)}</div>
                </div>`;

            current.setUTCMonth(current.getUTCMonth() + 1);
        }
    }
    

    heatmapContainer.innerHTML = html + `</div>`;
}

// ── Totals ────────────────────────────────────────────────────────────────────
function calcTotals() {
    let myTotal = 0, gTotal = 0, myTotal_count = 0, gTotal_count = 0;
    tableData.forEach(r => {
        if (r.pnl)          { myTotal += r.pnl;              if (r.pnl > 0)          myTotal_count++; }
        if (r.guriji?.pnl)  { gTotal  += Number(r.guriji.pnl); if (r.guriji.pnl > 0) gTotal_count++;  }
    });
    myPnlEl.textContent = formatLakhs(myTotal) + ' (' + myTotal_count + ')';
    myPnlEl.className   = myTotal > 0 ? 'positive' : myTotal < 0 ? 'negative' : '';
    gPnlEl.textContent  = formatPts(gTotal) + ' (' + gTotal_count + ')';
    gPnlEl.className    = gTotal  > 0 ? 'positive' : gTotal  < 0 ? 'negative' : '';
}

// ── Main render ───────────────────────────────────────────────────────────────
function updateView() {
    // Sort
    tableData.sort((a, b) => {
        const get = (obj, key) => key.includes('.')
            ? key.split('.').reduce((o, k) => o?.[k], obj)
            : obj[key];
        let vA = get(a, sortCol) ?? '';
        let vB = get(b, sortCol) ?? '';
        return (typeof vA === 'string' ? vA.localeCompare(vB) : vA - vB) * (sortAsc ? 1 : -1);
    });

    // Rebuild header (updates sort arrows & drag handlers)
    buildThead();

    // Rebuild rows using current column order
    tableBody.innerHTML = tableData.map(r =>
        `<tr>${columns.map(col => `<td>${col.render(r)}</td>`).join('')}</tr>`
    ).join('');

    calcTotals();
    renderHeatmap();
}

// Initial header build (no data yet)
buildThead();
fetchData();
async function fetchData() {
    console.log("fetchData");
    try {
        const response = await fetch('2.json');
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        tableData = data; updateView();
        
       
    } catch (error) {
        console.error('Error fetching data:', error);
    } 
}
