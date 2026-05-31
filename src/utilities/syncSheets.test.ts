const { parse } = require('csv-parse/sync');

describe('CSV Parsing Utility', () => {
  it('should correctly parse Google Sheets CSV export', () => {
    const csvData = `Email,Full Name,Member ID,Phone
test@example.com,John Doe,SY-001,123456789
jane@example.com,Jane Smith,SY-002,987654321`;

    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
    });

    expect(records).toHaveLength(2);
    expect(records[0]['Email']).toBe('test@example.com');
    expect(records[0]['Full Name']).toBe('John Doe');
    expect(records[1]['Member ID']).toBe('SY-002');
  });

  it('should handle different column naming variations', () => {
    const csvData = `email,Name,ID,phoneNumber
test@example.com,John Doe,SY-001,123456789`;

    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
    });

    const record = records[0];
    const email = record['Email'] || record['email'];
    const fullName = record['Full Name'] || record['Name'] || record['fullName'];

    expect(email).toBe('test@example.com');
    expect(fullName).toBe('John Doe');
  });
});
