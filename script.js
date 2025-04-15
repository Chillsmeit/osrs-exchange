// Global variables
let itemData = [];
let currentSort = { column: null, direction: 'asc' };

// DOM elements
const tableBody = document.getElementById('tableBody');
const refreshBtn = document.getElementById('refreshBtn');
const searchInput = document.getElementById('searchInput');
const loadingSpinner = document.getElementById('loadingSpinner');
const priceTable = document.getElementById('priceTable');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    
    // Set up event listeners
    refreshBtn.addEventListener('click', fetchData);
    searchInput.addEventListener('input', filterTable);
    
    // Set up sorting
    const headers = priceTable.querySelectorAll('th[data-sort]');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const column = header.getAttribute('data-sort');
            sortTable(column);
        });
    });
});

async function fetchData() {
    try {
        loadingSpinner.style.display = 'block';
        tableBody.innerHTML = '';
        
        // Fetch all data in parallel
        const [priceData, mappingData, volumeData, gePrices] = await Promise.all([
            fetch('https://prices.runescape.wiki/api/v1/osrs/latest').then(res => res.json()),
            fetch('https://prices.runescape.wiki/api/v1/osrs/mapping').then(res => res.json()),
            fetch('https://prices.runescape.wiki/api/v1/osrs/volumes').then(res => res.json()),
            fetch('https://oldschool.runescape.wiki/?title=Module:GEPrices/data.json&action=raw&ctype=application%2Fjson').then(res => res.json())
        ]);
        
        const natureRunePrice = priceData.data["561"]?.high || 105;
        
        // Process data
        itemData = mappingData.map(item => {
            const id = item.id.toString();
            const price = priceData.data[id];
            const volume = volumeData.data[id];
            const gePrice = gePrices[item.name] || gePrices[item.name.toLowerCase()] || null;
            const highAlch = item.highalch || null;
            
            let profitAfterTax = 0;
            let roiAfterTax = 0;
            let alchProfit = 0;
            
            if (price) {
                const sellPrice = price.high || 0;
                const buyPrice = price.low || 0;
                const saleTax = buyPrice * 0.01;
                const profitBeforeTax = sellPrice - buyPrice;
                profitAfterTax = profitBeforeTax - saleTax;
                roiAfterTax = (profitAfterTax / buyPrice) || 0;
                
                if (highAlch && gePrice) {
                    alchProfit = highAlch - ((gePrice * 1.01) + natureRunePrice);
                }
            }
            
            return {
                id: item.id,
                name: item.name,
                gePrice: gePrice,
                lowPrice: price?.low || null,
                highPrice: price?.high || null,
                profit: Math.floor(profitAfterTax),
                roi: roiAfterTax,
                highAlch: highAlch,
                alchProfit: Math.floor(alchProfit),
                limit: item.limit || null,
                volume: volume || null,
                wikiLink: `https://oldschool.runescape.wiki/w/${item.name.replace(/ /g, "_")}`
            };
        });
        
        renderTable(itemData);
        loadingSpinner.style.display = 'none';
    } catch (error) {
        console.error('Error fetching data:', error);
        loadingSpinner.style.display = 'none';
        alert('Failed to fetch data. Please try again later.');
    }
}

function renderTable(data) {
    tableBody.innerHTML = '';
    
    data.forEach(item => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${item.id}</td>
            <td><a href="${item.wikiLink}" target="_blank">${item.name}</a></td>
            <td>${formatNumber(item.gePrice)}</td>
            <td>${formatNumber(item.lowPrice)}</td>
            <td>${formatNumber(item.highPrice)}</td>
            <td class="${getProfitClass(item.profit)}">${formatNumber(item.profit)}</td>
            <td class="${getProfitClass(item.roi)}">${formatPercentage(item.roi)}</td>
            <td>${formatNumber(item.highAlch)}</td>
            <td class="${getProfitClass(item.alchProfit)}">${formatNumber(item.alchProfit)}</td>
            <td>${formatNumber(item.limit)}</td>
            <td>${formatNumber(item.volume)}</td>
        `;
        
        tableBody.appendChild(row);
    });
}

function sortTable(column) {
    // Toggle direction if same column clicked
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'asc';
    }
    
    const sortedData = [...itemData].sort((a, b) => {
        // Handle null values
        if (a[column] === null) return currentSort.direction === 'asc' ? 1 : -1;
        if (b[column] === null) return currentSort.direction === 'asc' ? -1 : 1;
        
        // Numeric comparison
        if (typeof a[column] === 'number' && typeof b[column] === 'number') {
            return currentSort.direction === 'asc' ? a[column] - b[column] : b[column] - a[column];
        }
        
        // String comparison
        if (typeof a[column] === 'string' && typeof b[column] === 'string') {
            return currentSort.direction === 'asc' 
                ? a[column].localeCompare(b[column]) 
                : b[column].localeCompare(a[column]);
        }
        
        return 0;
    });
    
    renderTable(sortedData);
    
    // Update UI to show current sort
    const headers = priceTable.querySelectorAll('th[data-sort]');
    headers.forEach(header => {
        header.classList.remove('sorted-asc', 'sorted-desc');
        if (header.getAttribute('data-sort') === column) {
            header.classList.add(`sorted-${currentSort.direction}`);
        }
    });
}

function filterTable() {
    const searchTerm = searchInput.value.toLowerCase();
    if (!searchTerm) {
        renderTable(itemData);
        return;
    }
    
    const filteredData = itemData.filter(item => 
        item.name.toLowerCase().includes(searchTerm) || 
        item.id.toString().includes(searchTerm)
    );
    
    renderTable(filteredData);
}

// Helper functions
function formatNumber(num) {
    if (num === null || num === undefined) return '-';
    return num.toLocaleString();
}

function formatPercentage(num) {
    if (num === null || num === undefined) return '-';
    return (num * 100).toFixed(2) + '%';
}

function getProfitClass(value) {
    if (value === null || value === undefined) return '';
    return value > 0 ? 'text-success' : value < 0 ? 'text-danger' : '';
}
