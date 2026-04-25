let tableData = [], sortCol = 'date', sortAsc = false;
const s = id => document.getElementById(id);
const q = sel => document.querySelectorAll(sel);

const tableBody = s('table-body'), myPnlEl = s('my-total-pnl'), gPnlEl = s('guriji-total-pnl');
const heatmapContainer = s('heatmap-container'), themeToggle = s('theme-toggle');

themeToggle.onclick = () => {
    document.body.classList.toggle('light-theme');
    themeToggle.textContent = document.body.classList.contains('light-theme') ? '☀️' : '🌙';
};

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

const formatLakhs = v => v == null ? '-' : (v / 100000).toFixed(2);
const formatPts = v => v == null ? '-' : Number(v).toFixed(2);
const formatInr = v => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v);

function getDay(dateStr) {
    if (!dateStr) return '-';
    return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(dateStr).getUTCDay()] || '-';
}

const renderStars = r => {
    const v = parseInt(r);
    return v > 0 ? Array.from({length:3}, (_,i) => `<span class="star ${i < v ? 'filled' : ''}">★</span>`).join('') : '-';
};

function renderHeatmap() {
    if(!tableData.length) { heatmapContainer.innerHTML = ''; return; }
    
    let dates = tableData.map(d => new Date(d.date).getTime()).filter(x => !isNaN(x));
    if(!dates.length) return;
    
    const minDateTs = Math.min(...dates);
    const maxDateTs = Math.max(...dates);
    const minDate = new Date(minDateTs);
    const maxDate = new Date(maxDateTs);
    
    let current = new Date(Date.UTC(minDate.getUTCFullYear(), minDate.getUTCMonth(), 1));
    const endMonth = new Date(Date.UTC(maxDate.getUTCFullYear(), maxDate.getUTCMonth(), 1));
    
    const pnlMap = {};
    let maxProfit = 0, maxLoss = 0;
    tableData.forEach(r => {
        if(!r.date || typeof r.pnl !== 'number') return;
        pnlMap[r.date] = r.pnl;
        if(r.pnl > maxProfit) maxProfit = r.pnl;
        if(r.pnl < maxLoss) maxLoss = r.pnl;
    });
    
    let html = `<div class="heatmap-wrapper">`;
    
    while(current <= endMonth) {
        const year = current.getUTCFullYear();
        const month = current.getUTCMonth();
        
        let monthLabel = current.toLocaleString('default', { month: 'short', timeZone: 'UTC' }) + ' ' + year.toString().slice(2);
        
        let monthPnl = 0;
        let tradeCount = 0;
        let cellsHtml = '';
        
        let firstDay = new Date(Date.UTC(year, month, 1));
        let cursor = new Date(firstDay);
        const dayOfWeek = cursor.getUTCDay();
        cursor.setUTCDate(cursor.getUTCDate() + (dayOfWeek === 0 ? -6 : 1 - dayOfWeek));
        
        while(true) {
            for(let i=0; i<5; i++) {
                if(cursor.getUTCMonth() === month) {
                    const dStr = cursor.toISOString().split('T')[0];
                    const pnl = pnlMap[dStr];
                    
                    let bgStyle = '';
                    if(pnl !== undefined) {
                        monthPnl += pnl;
                        tradeCount++;
                        if(pnl > 0) bgStyle = `background: rgba(16, 185, 129, ${Math.max(0.3, pnl / (maxProfit || 1))});`;
                        else if(pnl < 0) bgStyle = `background: rgba(239, 68, 68, ${Math.max(0.3, pnl / (maxLoss || -1))});`;
                        else bgStyle = `background: var(--heatmap-empty);`;
                    }
                    const tooltip = pnl !== undefined ? `${dStr} | PnL: ${formatInr(pnl)}` : `${dStr} | No Trades`;
                    cellsHtml += `<div class="heatmap-cell" style="${bgStyle}" data-tooltip="${tooltip}"></div>`;
                } else {
                    cellsHtml += `<div class="heatmap-cell empty"></div>`;
                }
                cursor.setUTCDate(cursor.getUTCDate() + 1);
            }
            cursor.setUTCDate(cursor.getUTCDate() + 2);
            if(cursor.getUTCMonth() !== month && cursor > firstDay) break;
        }

        const divClass = monthPnl > 0 ? 'positive' : monthPnl < 0 ? 'negative' : '';
        html += `
            <div class="month-block">
                <div class="month-header">${monthLabel} (${tradeCount} trades)</div>
                <div class="month-divider ${divClass}"></div>
                <div class="month-grid">${cellsHtml}</div>
                <div class="month-footer ${divClass}">${formatInr(monthPnl)}</div>
            </div>
        `;
        
        current.setUTCMonth(current.getUTCMonth() + 1);
    }
    
    html += `</div>`;
    heatmapContainer.innerHTML = html;
}

function calcTotals() {
    let myTotal = 0, gTotal = 0;
    tableData.forEach(r => {
        if(r.pnl) myTotal += r.pnl;
        if(r.guriji?.pnl) gTotal += Number(r.guriji.pnl);
    });
    myPnlEl.textContent = formatLakhs(myTotal);
    myPnlEl.className = myTotal > 0 ? 'positive' : myTotal < 0 ? 'negative' : '';
    gPnlEl.textContent = formatPts(gTotal);
    gPnlEl.className = gTotal > 0 ? 'positive' : gTotal < 0 ? 'negative' : '';
}

function updateView() {
    document.querySelector('.controls').remove();

    tableData.sort((a, b) => {
        let vA = (sortCol.includes('.') ? sortCol.split('.').reduce((o, i) => o?.[i], a) : a[sortCol]) ?? '';
        let vB = (sortCol.includes('.') ? sortCol.split('.').reduce((o, i) => o?.[i], b) : b[sortCol]) ?? '';
        return (typeof vA === 'string' ? vA.localeCompare(vB) : vA - vB) * (sortAsc ? 1 : -1);
    });

    tableBody.innerHTML = tableData.map(r => `
        <tr>
            <td>${r.date || '-'}</td>
            <td style="color:var(--text-secondary);font-weight:600">${getDay(r.date)}</td>
            <td><span class="direction-badge direction-${(r.direction||'').toLowerCase()}">${r.direction||'-'}</span></td>
            <td>${formatLakhs(r.capitalUsed)}</td>
            <td>${r.entryTime||'-'}</td><td>${r.exitTime||'-'}</td>
            <td class="${r.pnl>0?'positive':r.pnl<0?'negative':''}">${formatLakhs(r.pnl)}</td>
            <td>${renderStars(r.rating?.plan)}</td><td>${renderStars(r.rating?.entry)}</td><td>${renderStars(r.rating?.exit)}</td>
            <td>${r.guriji?.direction ? `<span class="direction-badge direction-${r.guriji.direction.toLowerCase()}">${r.guriji.direction}</span>` : '-'}</td>
            <td>${r.guriji?.entryTime||'-'}</td><td>${r.guriji?.exitTime||'-'}</td>
            <td class="${r.guriji?.pnl>0?'positive':r.guriji?.pnl<0?'negative':''}">${r.guriji?.pnl!=null?r.guriji.pnl:'-'}</td>
        </tr>`).join('');
    
    q('th[data-sort]').forEach(th => {
        let span = th.querySelector('span');
        if (th.dataset.sort === sortCol) span.textContent = sortAsc ? '↑' : '↓';
        else span.textContent = th.dataset.sort.includes('rating') ? '-' : '↕';
    });
    calcTotals();
    renderHeatmap();
}

q('th[data-sort]').forEach(th => th.onclick = () => {
    sortAsc = sortCol === th.dataset.sort ? !sortAsc : false;
    sortCol = th.dataset.sort;
    updateView();
});
