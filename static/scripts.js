// static/script.js

// Initialize violation count
let violationCount = 0;

function addViolation() {
    violationCount++;
    const violationsDiv = document.getElementById('violationsContainer');

    const newViolation = document.createElement('div');
    newViolation.className = 'violation';
    newViolation.id = `violation_${violationCount}`;

    newViolation.innerHTML = `
        <h4>Violation ${violationCount}</h4>
        <label>
            Statute:
            <input type="text" name="statute_${violationCount}" required>
        </label>
        <label>
            Violation Description:
            <input type="text" name="charge_${violationCount}" required>
        </label>
        <label>
            Violation Code:
            <input type="text" name="violationCode_${violationCount}">
        </label>
        <label>
            Fine Amount:
            <input type="text" name="fineAmount_${violationCount}">
        </label>
        <label>
            Points:
            <input type="number" name="points_${violationCount}">
        </label>
        <label>
            MPH Over Limit:
            <input type="number" name="mphOverLimit_${violationCount}">
        </label>
        <label>
            Summons Required:
            <input type="checkbox" name="summons_${violationCount}" id="summons_${violationCount}">
        </label>
        ${violationCount > 1 ? `<button type="button" onclick="removeViolation(${violationCount})">Remove Violation</button>` : ''}
        <hr>
    `;
    violationsDiv.appendChild(newViolation);
    updateViolationHeaders();

    // Add event listener for Summons checkbox
    const summonsCheckbox = newViolation.querySelector(`input[name="summons_${violationCount}"]`);
    const fineInput = newViolation.querySelector(`input[name="fineAmount_${violationCount}"]`);

    summonsCheckbox.addEventListener('change', function() {
        if (this.checked) {
            fineInput.value = 'SUMMONS';
            fineInput.readOnly = true;
            fineInput.style.backgroundColor = '#e9ecef';  // Optional: To make it look disabled
        } else {
            fineInput.value = '';
            fineInput.readOnly = false;
            fineInput.style.backgroundColor = '';  // Reset background color
        }
    });
}

function removeViolation(id) {
    const violationDiv = document.getElementById(`violation_${id}`);
    violationDiv.remove();
    updateViolationHeaders();
}

function updateViolationHeaders() {
    const violations = document.querySelectorAll('.violation');
    let count = 1;
    violations.forEach(function(violationDiv) {
        const header = violationDiv.querySelector('h4');
        header.textContent = `Violation ${count}`;
        const removeButton = violationDiv.querySelector('button');
        if (removeButton) {
            if (count === 1) {
                removeButton.style.display = 'none';
            } else {
                removeButton.style.display = 'inline';
            }
        }
        count++;
    });
    violationCount = violations.length;
}

// Mailing Address Same logic
const mailingAddressRadios = document.getElementsByName('mailing_address_same');
mailingAddressRadios.forEach(function(radio) {
    radio.addEventListener('change', function() {
        if (this.value === 'No') {
            document.getElementById('mailingAddressFields').style.display = 'block';
        } else {
            document.getElementById('mailingAddressFields').style.display = 'none';
        }
    });
});

// Decode VIN function
function decodeVIN() {
    const vin = document.getElementById('vin').value.trim();
    if (vin.length === 17) {
        fetch(`/decode_vin/${vin}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    document.getElementById('make').value = data.make;
                    document.getElementById('model').value = data.model;
                    document.getElementById('year').value = data.year;
                    document.getElementById('vehicle_color').value = data.vehicle_color;
                } else {
                    alert('VIN decoding failed. Please check the VIN and try again.');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('An error occurred while decoding the VIN.');
            });
    } else {
        alert('Please enter a valid 17-character VIN.');
    }
}

// Decode PDF417 Barcode function
function decodeBarcode() {
    const barcodeData = document.getElementById('barcodeData').value.trim();
    if (barcodeData) {
        fetch('/decode_pdf417', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `barcodeData=${encodeURIComponent(barcodeData)}`
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    document.getElementById('firstName').value = data.firstName || '';
                    document.getElementById('lastName').value = data.lastName || '';
                    document.getElementById('dob').value = data.dob || '';
                    document.getElementById('oln').value = data.oln || '';
                    document.getElementById('streetAddress').value = data.streetAddress || '';
                    document.getElementById('city').value = data.city || '';
                    document.getElementById('state').value = data.state || '';
                    document.getElementById('zipCode').value = data.zipCode || '';
                } else {
                    alert('Barcode decoding failed. Please try again.');
                }
            })
            .catch(error => {
                console.error('Error decoding barcode:', error);
                alert('An error occurred while decoding the barcode.');
            });
    } else {
        alert('Please enter barcode data.');
    }
}

// On page load
window.onload = function() {
    addViolation(); // Add the first violation by default

    // Ensure at least one checkbox is checked between Penalty Assessment and Summons & Complaint
    document.querySelector("form").addEventListener("submit", function(event) {
        const penaltyAssessmentChecked = document.getElementById("penaltyAssessment").checked;
        const summonsComplaintChecked = document.getElementById("summonsComplaint").checked;

        if (!penaltyAssessmentChecked && !summonsComplaintChecked) {
            alert("Please select either 'Penalty Assessment' or 'Summons & Complaint'.");
            event.preventDefault();  // Stop form submission
        }
    });

    // Show/hide owner info if ownership is not the same
    document.getElementById('ownershipSame').addEventListener('change', function() {
        updateOwnerInfo();
        document.getElementById('ownerInfo').style.display = this.checked ? 'none' : 'block';
    });

    // Update owner info when defendant info changes
    ['firstName', 'lastName', 'streetAddress', 'city', 'state', 'zipCode'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateOwnerInfo);
    });
};

function updateOwnerInfo() {
    if (document.getElementById('ownershipSame').checked) {
        document.getElementById('ownerName').value = `${document.getElementById('firstName').value} ${document.getElementById('lastName').value}`;
        document.getElementById('ownerAddress').value = `${document.getElementById('streetAddress').value}, ${document.getElementById('city').value}, ${document.getElementById('state').value} ${document.getElementById('zipCode').value}`;
    }
}