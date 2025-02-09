const price = 19.5;
let cid = [
    ["PENNY", 1.01],
    ["NICKEL", 2.05],
    ["DIME", 3.1],
    ["QUARTER", 4.25],
    ["ONE", 90],
    ["FIVE", 55],
    ["TEN", 20],
    ["TWENTY", 60],
    ["ONE HUNDRED", 100]
];

document.getElementById("purchase-btn").addEventListener("click", function() {
    let cash = parseFloat(document.getElementById("cash").value);
    let changeDueElement = document.getElementById("change-due");
    
    if (cash < price) {
        alert("Customer does not have enough money to purchase the item");
        return;
    }
    
    let changeDue = cash - price;
    if (changeDue === 0) {
        changeDueElement.textContent = "No change due - customer paid with exact cash";
        return;
    }
    
    let totalCid = cid.reduce((sum, curr) => sum + curr[1], 0).toFixed(2);
    if (parseFloat(totalCid) < changeDue) {
        changeDueElement.textContent = "Status: INSUFFICIENT_FUNDS";
        return;
    }
    
    let changeArray = [];
    let currencyUnits = [
        ["ONE HUNDRED", 100],
        ["TWENTY", 20],
        ["TEN", 10],
        ["FIVE", 5],
        ["ONE", 1],
        ["QUARTER", 0.25],
        ["DIME", 0.1],
        ["NICKEL", 0.05],
        ["PENNY", 0.01]
    ];
    
    for (let [name, value] of currencyUnits) {
        let amount = 0;
        for (let [cidName, cidValue] of cid) {
            if (cidName === name) {
                while (changeDue >= value && cidValue > 0) {
                    changeDue -= value;
                    changeDue = Math.round(changeDue * 100) / 100;
                    cidValue -= value;
                    amount += value;
                }
            }
        }
        if (amount > 0) {
            changeArray.push([name, amount]);
        }
    }
    
    if (changeDue > 0) {
        changeDueElement.textContent = "Status: INSUFFICIENT_FUNDS";
        return;
    }
    
    if (parseFloat(totalCid) === cash - price) {
        changeDueElement.textContent = "Status: CLOSED " + changeArray.map(c => `${c[0]}: $${c[1]}`).join(" ");
        return;
    }
    
    changeDueElement.textContent = "Status: OPEN " + changeArray.map(c => `${c[0]}: $${c[1]}`).join(" ");
});

document.getElementById