-- Remove registros com email inválido causado por bug no parsing de XLSX
-- O ExcelJS retornava objetos de hyperlink/rich text em vez de strings,
-- resultando em email = '[object Object]'
DELETE FROM registrations WHERE email = '[object Object]';
