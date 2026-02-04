// State
let prepayments = [];
let currentData = null;
let paidMonthsCount = 0;
let currentPage = 1;
let itemsPerPage = 50;
let charts = {
    balance: null,
    interest: null,
    annual: null,
    emiBreakdown: null
};

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Add event listeners
    document.getElementById('loanAmount').addEventListener('input', handleInputChange);
    document.getElementById('annualRate').addEventListener('input', handleInputChange);
    document.getElementById('tenureValue').addEventListener('input', handleInputChange);
    document.getElementById('tenureUnit').addEventListener('change', handleInputChange);
    
    // Initial calculation
    updateHelperTexts();
    calculateEMI();
});

// EMI Calculation Functions
function calculateEMIAmount(principal, annualRate, months) {
    const monthlyRate = annualRate / 12 / 100;
    if (monthlyRate === 0) {
        return principal / months;
    }
    const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / 
                (Math.pow(1 + monthlyRate, months) - 1);
    return emi;
}

function generateSchedule(principal, annualRate, months, prepaymentsList) {
    const monthlyRate = annualRate / 12 / 100;
    const emi = calculateEMIAmount(principal, annualRate, months);
    
    const schedule = [];
    let balance = principal;
    let totalInterest = 0;
    let totalPrincipal = 0;
    let month = 1;
    
    const sortedPrepayments = prepaymentsList.sort((a, b) => a.timing - b.timing);
    let prepaymentIndex = 0;
    
    while (balance > 0.01 && month <= months * 2) {
        const interestPayment = balance * monthlyRate;
        let principalPayment = Math.min(emi - interestPayment, balance);
        
        let prepaymentAmount = 0;
        while (prepaymentIndex < sortedPrepayments.length && 
               sortedPrepayments[prepaymentIndex].timing === month) {
            prepaymentAmount += sortedPrepayments[prepaymentIndex].amount;
            prepaymentIndex++;
        }
        
        // Auto-adjust prepayment if it exceeds remaining balance
        if (prepaymentAmount > 0) {
            const remainingAfterEMI = balance - principalPayment;
            if (prepaymentAmount > remainingAfterEMI) {
                prepaymentAmount = remainingAfterEMI; // Adjust to exact remaining balance
            }
            principalPayment += prepaymentAmount;
        }
        
        balance -= principalPayment;
        totalInterest += interestPayment;
        totalPrincipal += principalPayment;
        
        schedule.push({
            month: month,
            emi: Math.round((interestPayment + principalPayment - prepaymentAmount) * 100) / 100,
            interest: Math.round(interestPayment * 100) / 100,
            principal: Math.round(principalPayment * 100) / 100,
            prepayment: Math.round(prepaymentAmount * 100) / 100,
            balance: Math.round(Math.max(0, balance) * 100) / 100,
            totalInterest: Math.round(totalInterest * 100) / 100,
            totalPrincipal: Math.round(totalPrincipal * 100) / 100
        });
        
        month++;
        
        if (balance < 0.01) {
            break;
        }
    }
    
    return schedule;
}

function generateAnnualSummary(schedule) {
    const annual = [];
    let year = 1;
    let yearPrincipal = 0;
    let yearInterest = 0;
    
    schedule.forEach((entry, idx) => {
        yearPrincipal += entry.principal;
        yearInterest += entry.interest;
        
        if ((idx + 1) % 12 === 0 || idx === schedule.length - 1) {
            annual.push({
                year: year,
                principal: Math.round(yearPrincipal * 100) / 100,
                interest: Math.round(yearInterest * 100) / 100,
                total: Math.round((yearPrincipal + yearInterest) * 100) / 100
            });
            year++;
            yearPrincipal = 0;
            yearInterest = 0;
        }
    });
    
    return annual;
}

// Mark paid EMIs
function markPaidEMIs() {
    const months = parseInt(document.getElementById('paidMonths').value) || 0;
    
    // Calculate total tenure in months
    const tenureValue = parseFloat(document.getElementById('tenureValue').value) || 0;
    const tenureUnit = document.getElementById('tenureUnit').value;
    let totalMonths = tenureValue;
    if (tenureUnit === 'years') totalMonths = tenureValue * 12;
    if (tenureUnit === 'quarters') totalMonths = tenureValue * 3;
    totalMonths = Math.round(totalMonths);
    
    if (months < 0) {
        alert('Please enter a valid number of months');
        return;
    }
    
    if (months === 0) {
        alert('Please enter the number of months you have paid');
        return;
    }
    
    // Validate against total tenure
    if (months >= totalMonths) {
        alert(`⚠️ Invalid Input!\n\nYou cannot mark ${months} EMIs as paid.\nYour total loan tenure is only ${totalMonths} months.\n\nPlease enter a value less than ${totalMonths}.`);
        return;
    }
    
    paidMonthsCount = months;
    
    // Update the "Start From (Month)" field to the next month after paid EMIs
    const recurringStartField = document.getElementById('recurringStart');
    recurringStartField.value = months + 1;
    
    // Show confirmation message
    alert(`✓ Marked ${months} EMI${months > 1 ? 's' : ''} as paid!\n\nPrepayment "Start From" updated to Month ${months + 1}`);
    
    // Optional: Highlight the updated field briefly
    recurringStartField.style.backgroundColor = '#fff3cd';
    recurringStartField.style.border = '2px solid #ffc107';
    
    setTimeout(() => {
        recurringStartField.style.backgroundColor = '';
        recurringStartField.style.border = '';
    }, 2000);
    
    if (currentData) {
        updateTables(currentData);
    }
}

// Handle input changes
function handleInputChange() {
    updateHelperTexts();
    currentPage = 1;
    paidMonthsCount = 0; // Reset paid EMIs count
    document.getElementById('paidMonths').value = 0; // Reset the input field
    calculateEMI();
}

// Update helper texts
function updateHelperTexts() {
    const loanAmount = parseFloat(document.getElementById('loanAmount').value) || 0;
    document.getElementById('loanAmountText').textContent = formatCurrency(loanAmount);
    
    const tenureValue = parseFloat(document.getElementById('tenureValue').value) || 0;
    const tenureUnit = document.getElementById('tenureUnit').value;
    let months = tenureValue;
    if (tenureUnit === 'years') months = tenureValue * 12;
    if (tenureUnit === 'quarters') months = tenureValue * 3;
    document.getElementById('tenureText').textContent = `${Math.round(months)} months total`;
}

// Add prepayment
function addPrepayment() {
    const amount = parseFloat(document.getElementById('prepayAmount').value);
    const start = parseInt(document.getElementById('recurringStart').value) || 1;
    const interval = parseInt(document.getElementById('recurringInterval').value);
    const count = parseInt(document.getElementById('recurringCount').value) || null;
    const loanAmount = parseFloat(document.getElementById('loanAmount').value) || 0;
    
    if (!amount || amount <= 0) {
        alert('Please enter a valid prepayment amount');
        return;
    }
    
    if (amount > loanAmount) {
        alert(`⚠️ Invalid Prepayment Amount!\n\nPrepayment amount (${formatCurrency(amount)}) cannot be more than the loan amount (${formatCurrency(loanAmount)}).\n\nPlease enter a smaller amount.`);
        return;
    }
    
    if (!interval || interval <= 0) {
        alert('Please enter a valid interval');
        return;
    }
    
    let prepaymentData = {
        id: Date.now(),
        amount: amount,
        type: 'recurring',
        recurringStart: start,
        recurringInterval: interval,
        recurringCount: count,
        description: `${formatCurrency(amount)} every ${interval} months from month ${start}${count ? ` (${count} times)` : ''}`
    };
    
    prepayments.push(prepaymentData);
    
    // Clear ALL inputs
    document.getElementById('prepayAmount').value = '';
    document.getElementById('recurringStart').value = '1';
    document.getElementById('recurringInterval').value = '12';
    document.getElementById('recurringCount').value = '';
    
    currentPage = 1;
    updatePrepaymentList();
    calculateEMI();
}

// Remove prepayment
function removePrepayment(id) {
    prepayments = prepayments.filter(p => p.id !== id);
    currentPage = 1;
    updatePrepaymentList();
    calculateEMI();
}

// Update prepayment list display
function updatePrepaymentList() {
    const container = document.getElementById('prepaymentList');
    
    if (prepayments.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    let html = '<div class="prepayment-list"><h4>Active Prepayments</h4><div class="prepayment-items">';
    prepayments.forEach(prep => {
        html += `
            <div class="prepayment-item">
                <div class="prepayment-info">${prep.description}</div>
                <button class="btn btn-danger" onclick="removePrepayment(${prep.id})">🗑️</button>
            </div>
        `;
    });
    html += '</div></div>';
    
    container.innerHTML = html;
}

// Expand prepayments to individual month entries
function expandPrepayments(totalMonths) {
    const expanded = [];
    
    prepayments.forEach(prep => {
        if (prep.type === 'recurring') {
            let month = prep.recurringStart;
            let count = 0;
            
            while (month <= totalMonths) {
                expanded.push({
                    amount: prep.amount,
                    timing: month,
                    timingUnit: 'month'
                });
                
                month += prep.recurringInterval;
                count++;
                
                if (prep.recurringCount && count >= prep.recurringCount) {
                    break;
                }
            }
        }
    });
    
    return expanded;
}

// Calculate EMI - Main function
function calculateEMI() {
    const loanAmount = parseFloat(document.getElementById('loanAmount').value) || 0;
    const annualRate = parseFloat(document.getElementById('annualRate').value) || 0;
    const tenureValue = parseFloat(document.getElementById('tenureValue').value) || 0;
    const tenureUnit = document.getElementById('tenureUnit').value;
    
    
    if (loanAmount < 1000) {
        const loanAmountInput = document.getElementById("loanAmount");
        const loanAmountError = document.getElementById("loanAmountError");
        if (loanAmountError) loanAmountError.classList.add("show");
        if (loanAmountInput) loanAmountInput.classList.add("input-error");
        document.getElementById("baseSummary").innerHTML = "<div class=\"loading\">⚠️ Please enter a valid loan amount (minimum ₹1,000)</div>";
        document.getElementById("prepaymentSummary").innerHTML = "<div class=\"loading\">⚠️ Please enter a valid loan amount (minimum ₹1,000)</div>";
        return;
    }
    
    const loanAmountInput = document.getElementById("loanAmount");
    const loanAmountError = document.getElementById("loanAmountError");
    if (loanAmountError) loanAmountError.classList.remove("show");
    if (loanAmountInput) loanAmountInput.classList.remove("input-error");

    if (loanAmount > 100000000) {
        alert('⚠️ Maximum loan amount should be ₹10 Crores (₹10,00,00,000)');
        document.getElementById('loanAmount').value = 100000000;
        return;
    }

    if (loanAmount <= 0 || annualRate <= 0 || tenureValue <= 0) {
        return;
    }
    
    // Get tenure in months
    let totalMonths = tenureValue;
    if (tenureUnit === 'years') totalMonths = tenureValue * 12;
    if (tenureUnit === 'quarters') totalMonths = tenureValue * 3;
    totalMonths = Math.round(totalMonths);
    
    // Expand all prepayments to individual entries
    const expandedPrepayments = expandPrepayments(totalMonths);
    
    // Generate schedules
    const baseSchedule = generateSchedule(loanAmount, annualRate, totalMonths, []);
    const prepaymentSchedule = generateSchedule(loanAmount, annualRate, totalMonths, expandedPrepayments);
    
    // Calculate summaries
    const baseLast = baseSchedule[baseSchedule.length - 1];
    const prepLast = prepaymentSchedule[prepaymentSchedule.length - 1];
    const emi = calculateEMIAmount(loanAmount, annualRate, totalMonths);
    const totalPrepayment = prepaymentSchedule.reduce((sum, entry) => sum + entry.prepayment, 0);
    
    const baseSummary = {
        emi: Math.round(emi * 100) / 100,
        totalInterest: baseLast.totalInterest,
        totalAmount: Math.round((loanAmount + baseLast.totalInterest) * 100) / 100,
        tenure: baseSchedule.length
    };
    
    const prepaymentSummary = {
        emi: Math.round(emi * 100) / 100,
        totalInterest: prepLast.totalInterest,
        totalAmount: Math.round((loanAmount + prepLast.totalInterest) * 100) / 100,
        tenure: prepaymentSchedule.length,
        interestSaved: Math.round((baseLast.totalInterest - prepLast.totalInterest) * 100) / 100,
        tenureReduced: baseSchedule.length - prepaymentSchedule.length,
        totalPrepayment: Math.round(totalPrepayment * 100) / 100
    };
    
    const annualSummary = generateAnnualSummary(prepaymentSchedule);
    
    // Store data
    currentData = {
        baseSchedule,
        prepaymentSchedule,
        baseSummary,
        prepaymentSummary,
        annualSummary
    };
    
    // Update UI
    updateSummaryCards(currentData);
    updateCharts(currentData);
    updateTables(currentData);
}

// Update summary cards
function updateSummaryCards(data) {
    const { baseSummary, prepaymentSummary } = data;
    
    document.getElementById('baseSummary').innerHTML = `
        <div class="summary-item">
            <span class="summary-label">Monthly EMI</span>
            <span class="summary-value">${formatCurrency(baseSummary.emi)}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Total Interest</span>
            <span class="summary-value text-red">${formatCurrency(baseSummary.totalInterest)}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Total Amount</span>
            <span class="summary-value">${formatCurrency(baseSummary.totalAmount)}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Loan Tenure</span>
            <span class="summary-value">${baseSummary.tenure} months</span>
        </div>
    `;
    
    document.getElementById('prepaymentSummary').innerHTML = `
        <div class="summary-item">
            <span class="summary-label">Monthly EMI</span>
            <span class="summary-value">${formatCurrency(prepaymentSummary.emi)}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Total Interest</span>
            <span class="summary-value text-red">${formatCurrency(prepaymentSummary.totalInterest)}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Interest Saved</span>
            <span class="summary-value text-green">-${formatCurrency(prepaymentSummary.interestSaved)}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Total Amount</span>
            <span class="summary-value">${formatCurrency(prepaymentSummary.totalAmount)}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Tenure</span>
            <span class="summary-value">${prepaymentSummary.tenure} months (-${prepaymentSummary.tenureReduced})</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Total Prepayment</span>
            <span class="summary-value text-blue">${formatCurrency(prepaymentSummary.totalPrepayment)}</span>
        </div>
    `;
}

// Update charts
function updateCharts(data) {
    const { baseSchedule, prepaymentSchedule, annualSummary } = data;
    
    // Balance Chart
    if (charts.balance) charts.balance.destroy();
    const balanceCtx = document.getElementById('balanceChart').getContext('2d');
    const maxBalance = Math.max(...baseSchedule.map(m => m.balance));
    const balanceYAxis = getYAxisFormatter(maxBalance);
    
    charts.balance = new Chart(balanceCtx, {
        type: 'line',
        data: {
            labels: baseSchedule.map(m => m.month),
            datasets: [{
                label: 'Without Prepayment',
                data: baseSchedule.map(m => m.balance),
                borderColor: '#f56565',
                backgroundColor: 'rgba(245, 101, 101, 0.1)',
                fill: true
            }, {
                label: 'With Prepayment',
                data: prepaymentSchedule.map(m => m.balance),
                borderColor: '#48bb78',
                backgroundColor: 'rgba(72, 187, 120, 0.1)',
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: balanceYAxis
                }
            }
        }
    });
    
    // Interest Chart
    if (charts.interest) charts.interest.destroy();
    const interestCtx = document.getElementById('interestChart').getContext('2d');
    const maxInterest = Math.max(
        ...baseSchedule.map(m => m.totalInterest),
        ...prepaymentSchedule.map(m => m.totalInterest)
    );
    const interestYAxis = getYAxisFormatter(maxInterest);
    
    charts.interest = new Chart(interestCtx, {
        type: 'line',
        data: {
            labels: baseSchedule.map(m => m.month),
            datasets: [{
                label: 'Without Prepayment',
                data: baseSchedule.map(m => m.totalInterest),
                borderColor: '#f56565',
                backgroundColor: 'rgba(245, 101, 101, 0.1)',
                fill: true
            }, {
                label: 'With Prepayment',
                data: prepaymentSchedule.map(m => m.totalInterest),
                borderColor: '#48bb78',
                backgroundColor: 'rgba(72, 187, 120, 0.1)',
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: interestYAxis
                }
            }
        }
    });
    
    // Annual Chart
    if (charts.annual) charts.annual.destroy();
    const annualCtx = document.getElementById('annualChart').getContext('2d');
    const maxAnnual = Math.max(...annualSummary.map(y => y.total));
    const annualYAxis = getYAxisFormatter(maxAnnual);
    
    charts.annual = new Chart(annualCtx, {
        type: 'bar',
        data: {
            labels: annualSummary.map(y => `Year ${y.year}`),
            datasets: [{
                label: 'Principal',
                data: annualSummary.map(y => y.principal),
                backgroundColor: '#48bb78'
            }, {
                label: 'Interest',
                data: annualSummary.map(y => y.interest),
                backgroundColor: '#f56565'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                x: { stacked: true },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: annualYAxis
                }
            }
        }
    });
    
    // EMI Breakdown Chart
    if (charts.emiBreakdown) charts.emiBreakdown.destroy();
    const emiBreakdownCtx = document.getElementById('emiBreakdownChart').getContext('2d');
    const sampleMonths = prepaymentSchedule.filter((_, i) => i % Math.ceil(prepaymentSchedule.length / 24) === 0);
    const maxEMI = Math.max(...sampleMonths.map(m => m.principal + m.interest));
    const emiYAxis = getYAxisFormatter(maxEMI);
    
    charts.emiBreakdown = new Chart(emiBreakdownCtx, {
        type: 'bar',
        data: {
            labels: sampleMonths.map(m => `Month ${m.month}`),
            datasets: [{
                label: 'Principal',
                data: sampleMonths.map(m => m.principal),
                backgroundColor: '#48bb78'
            }, {
                label: 'Interest',
                data: sampleMonths.map(m => m.interest),
                backgroundColor: '#f56565'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                x: { stacked: true },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: emiYAxis
                }
            }
        }
    });
}

// Update tables
function updateTables(data) {
    updateMonthlyTable(data.prepaymentSchedule);
    
    // Annual table
    let annualHtml = `
        <table>
            <thead>
                <tr>
                    <th>Year</th>
                    <th class="text-right">Principal Paid</th>
                    <th class="text-right">Interest Paid</th>
                    <th class="text-right">Total Paid</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    data.annualSummary.forEach(entry => {
        annualHtml += `
            <tr>
                <td>${entry.year}</td>
                <td class="text-right text-green">${formatCurrency(entry.principal)}</td>
                <td class="text-right text-red">${formatCurrency(entry.interest)}</td>
                <td class="text-right">${formatCurrency(entry.total)}</td>
            </tr>
        `;
    });
    
    annualHtml += '</tbody></table>';
    document.getElementById('annualTable').innerHTML = annualHtml;
    
    // Comparison stats
    const { baseSummary, prepaymentSummary } = data;
    const comparisonStats = `
        <div class="stat-card">
            <div class="stat-label">Interest Saved</div>
            <div class="stat-value">${formatCurrency(prepaymentSummary.interestSaved)}</div>
        </div>
        <div class="stat-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
            <div class="stat-label">Tenure Reduced</div>
            <div class="stat-value">${prepaymentSummary.tenureReduced} months</div>
        </div>
        <div class="stat-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
            <div class="stat-label">Total Prepayment</div>
            <div class="stat-value">${formatCurrency(prepaymentSummary.totalPrepayment)}</div>
        </div>
    `;
    document.getElementById('comparisonStats').innerHTML = comparisonStats;
    
    // Comparison table
    const comparisonTable = `
        <table>
            <thead>
                <tr>
                    <th>Metric</th>
                    <th class="text-right">Without Prepayment</th>
                    <th class="text-right">With Prepayment</th>
                    <th class="text-right">Difference</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Total Interest</td>
                    <td class="text-right">${formatCurrency(baseSummary.totalInterest)}</td>
                    <td class="text-right">${formatCurrency(prepaymentSummary.totalInterest)}</td>
                    <td class="text-right text-green">${formatCurrency(prepaymentSummary.interestSaved)}</td>
                </tr>
                <tr>
                    <td>Total Amount</td>
                    <td class="text-right">${formatCurrency(baseSummary.totalAmount)}</td>
                    <td class="text-right">${formatCurrency(prepaymentSummary.totalAmount)}</td>
                    <td class="text-right text-green">${formatCurrency(baseSummary.totalAmount - prepaymentSummary.totalAmount)}</td>
                </tr>
                <tr>
                    <td>Loan Tenure</td>
                    <td class="text-right">${baseSummary.tenure} months</td>
                    <td class="text-right">${prepaymentSummary.tenure} months</td>
                    <td class="text-right text-green">${prepaymentSummary.tenureReduced} months</td>
                </tr>
            </tbody>
        </table>
    `;
    document.getElementById('comparisonTable').innerHTML = comparisonTable;
}

// Update monthly table with pagination
function updateMonthlyTable(schedule) {
    const totalPages = Math.ceil(schedule.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, schedule.length);
    const displayMonths = schedule.slice(startIndex, endIndex);
    
    let monthlyHtml = `
        <table>
            <thead>
                <tr>
                    <th>Month</th>
                    <th class="text-right">EMI</th>
                    <th class="text-right">Interest</th>
                    <th class="text-right">Principal</th>
                    <th class="text-right">Prepayment</th>
                    <th class="text-right">Balance</th>
                    <th class="text-center">Paid</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    displayMonths.forEach(entry => {
        const isPaid = entry.month <= paidMonthsCount;
        const rowClass = isPaid ? 'paid-row' : '';
        monthlyHtml += `
            <tr class="${rowClass}">
                <td>${entry.month}</td>
                <td class="text-right">${formatNumber(entry.emi)}</td>
                <td class="text-right text-red">${formatNumber(entry.interest)}</td>
                <td class="text-right text-green">${formatNumber(entry.principal)}</td>
                <td class="text-right text-blue">${entry.prepayment > 0 ? formatNumber(entry.prepayment) : '-'}</td>
                <td class="text-right">${formatNumber(entry.balance)}</td>
                <td class="text-center">${isPaid ? '✓' : ''}</td>
            </tr>
        `;
    });
    
    monthlyHtml += '</tbody></table>';
    document.getElementById('monthlyTable').innerHTML = monthlyHtml;
    
    // Update pagination
    let paginationHtml = `
        <button onclick="goToPage(1)" ${currentPage === 1 ? 'disabled' : ''}>First</button>
        <button onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>
        <span>Page ${currentPage} of ${totalPages} (${schedule.length} total EMIs)</span>
        <button onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
        <button onclick="goToPage(${totalPages})" ${currentPage === totalPages ? 'disabled' : ''}>Last</button>
    `;
    document.getElementById('monthlyPagination').innerHTML = paginationHtml;
}

// Navigate to specific page
function goToPage(page) {
    currentPage = page;
    if (currentData) {
        updateMonthlyTable(currentData.prepaymentSchedule);
    }
}

// Switch tabs
function switchTab(tabName) {
    const buttons = document.querySelectorAll('.tab-button');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    const panes = document.querySelectorAll('.tab-pane');
    panes.forEach(pane => pane.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
}

// Format currency
function formatCurrency(value) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(value);
}

// Format number
function formatNumber(value) {
    return new Intl.NumberFormat('en-IN', {
        maximumFractionDigits: 0
    }).format(value);
}

// Smart Y-axis formatter - adapts based on value range
function getYAxisFormatter(maxValue) {
    if (maxValue >= 10000000) { // 1 crore or more
        return {
            callback: function(value) {
                return '₹' + (value / 10000000).toFixed(1) + 'Cr';
            },
            stepSize: Math.ceil(maxValue / 10000000 / 5) * 10000000
        };
    } else if (maxValue >= 100000) { // 1 lakh or more
        return {
            callback: function(value) {
                return '₹' + (value / 100000).toFixed(1) + 'L';
            },
            stepSize: Math.ceil(maxValue / 100000 / 5) * 100000
        };
    } else if (maxValue >= 1000) { // 1 thousand or more
        return {
            callback: function(value) {
                return '₹' + (value / 1000).toFixed(0) + 'K';
            },
            stepSize: Math.ceil(maxValue / 1000 / 5) * 1000
        };
    } else { // Less than 1000
        return {
            callback: function(value) {
                return '₹' + value.toFixed(0);
            },
            stepSize: Math.ceil(maxValue / 5)
        };
    }
}
