
CREATE SCHEMA webmud;

USE webmud;

-- const chatOB = { type: 'new-message', from: msgOb.from, text: msgOb.text, date: timeStamp };

CREATE TABLE webchat ( timemsec BIGINT, msgfrom VARCHAR(50), message TEXT );

-- DROP TABlE webchat;

-- SELECT * FROM webchat ORDER BY timemsec;