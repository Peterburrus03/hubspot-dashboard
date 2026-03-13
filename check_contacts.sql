SELECT c."contactId", c."firstName", c."lastName", COUNT(e."engagementId") as linked_engagements
FROM contacts c
LEFT JOIN engagements e ON e."contactId" = c."contactId"
WHERE (c."firstName" = 'Rachel' AND c."lastName" = 'Davis')
   OR (c."firstName" = 'Jason' AND c."lastName" = 'King')
   OR (c."firstName" = 'Ruby' AND c."lastName" = 'Goldenberg')
GROUP BY c."contactId", c."firstName", c."lastName";
