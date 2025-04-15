// Global variables
let itemData = [];
let currentSort = { column: null, direction: 'asc' };

// DOM elements
const tableBody = document.getElementById('tableBody');
const refreshBtn = document.getElementById('refreshBtn');
const searchInput = document.getElementById('searchInput');
const loadingSpinner = document.getElementById('loadingSpinner');
const priceTable = document.getElementById('priceTable');
const errorAlert = document.getElementById('errorAlert');
const themeToggle = document.getElementById('themeToggle');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
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

// Theme Management
function initializeTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme');
    
    // Set dark mode as default (unless light mode is explicitly set)
    if (savedTheme === 'light') {
        setLightMode();
    } else {
        setDarkMode();
    }
}

function setDarkMode() {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
    themeToggle.innerHTML = '<i class="bi bi-moon-fill"></i> Dark Mode';
}

function setLightMode() {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
    themeToggle.innerHTML = '<i class="bi bi-sun-fill"></i> Light Mode';
}

function toggleTheme() {
    if (document.documentElement.getAttribute('data-theme') === 'dark') {
        setLightMode();
    } else {
        setDarkMode();
    }
}

themeToggle.addEventListener('click', toggleTheme);

async function fetchData() {
    try {
        showLoading();
        clearError();
        
        const [priceData, mappingData, volumeData, gePrices] = await Promise.all([
            fetch('https://prices.runescape.wiki/api/v1/osrs/latest').then(handleResponse),
            fetch('https://prices.runescape.wiki/api/v1/osrs/mapping').then(handleResponse),
            fetch('https://prices.runescape.wiki/api/v1/osrs/volumes').then(handleResponse),
            fetch('https://oldschool.runescape.wiki/?title=Module:GEPrices/data.json&action=raw&ctype=application%2Fjson').then(handleResponse)
        ]);
        
        const natureRuneGePrice = gePrices["Nature rune"] || gePrices["nature rune"] || 105;
        
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
                const saleTax = sellPrice * 0.01;
                const profitBeforeTax = sellPrice - buyPrice;
                profitAfterTax = profitBeforeTax - saleTax;
                roiAfterTax = (profitAfterTax / buyPrice) || 0;
                
                if (highAlch && gePrice) {
                    alchProfit = highAlch - (gePrice + natureRuneGePrice);
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
    } catch (error) {
        showError(`Failed to fetch data: ${error.message}`);
        console.error('Error fetching data:', error);
    } finally {
        hideLoading();
    }
}

function handleResponse(response) {
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
}

function renderTable(data) {
    tableBody.innerHTML = '';
    
    data.forEach(item => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${item.id}</td>
            <td><a href="${item.wikiLink}" target="_blank" rel="noopener">${item.name}</a></td>
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

    // Force column width recalculation
    setTimeout(() => {
        priceTable.style.width = 'auto';
        priceTable.style.tableLayout = 'auto';
    }, 50);
}

function sortTable(column) {
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'asc';
    }
    
    const sortedData = [...itemData].sort((a, b) => {
        if (a[column] === null) return currentSort.direction === 'asc' ? 1 : -1;
        if (b[column] === null) return currentSort.direction === 'asc' ? -1 : 1;
        
        if (typeof a[column] === 'number' && typeof b[column] === 'number') {
            return currentSort.direction === 'asc' ? a[column] - b[column] : b[column] - a[column];
        }
        
        if (typeof a[column] === 'string' && typeof b[column] === 'string') {
            return currentSort.direction === 'asc' 
                ? a[column].localeCompare(b[column]) 
                : b[column].localeCompare(a[column]);
        }
        
        return 0;
    });
    
    renderTable(sortedData);
    updateSortIndicator(column);
}

function updateSortIndicator(column) {
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

function showLoading() {
    loadingSpinner.style.display = 'block';
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Loading...';
}

function hideLoading() {
    loadingSpinner.style.display = 'none';
    refreshBtn.disabled = false;
    refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Refresh';
}

function showError(message) {
    errorAlert.textContent = message;
    errorAlert.style.display = 'block';
}

function clearError() {
    errorAlert.style.display = 'none';
    errorAlert.textContent = '';
}
