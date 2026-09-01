-- Reforça a ACL da função da extensão: remove a entrada PUBLIC (=X) e deixa
-- somente o proprietário/rotinas internas chamarem realtime.send.
revoke all privileges on function realtime.send(jsonb, text, text, boolean) from public;
