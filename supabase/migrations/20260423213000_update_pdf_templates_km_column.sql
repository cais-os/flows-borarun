UPDATE pdf_templates
SET
  html_content = REPLACE(
    REPLACE(html_content, '<th>RPE</th>', '<th>Km</th>'),
    '{{rpe}}',
    '{{distancia_km}}'
  ),
  updated_at = NOW()
WHERE html_content LIKE '%<th>RPE</th>%'
   OR html_content LIKE '%{{rpe}}%';
