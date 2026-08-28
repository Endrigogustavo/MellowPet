-- O app não usa Broadcast emitido pelo cliente. Revogar PUBLIC impede que
-- qualquer cliente injete eventos; os gatilhos SECURITY DEFINER continuam
-- aptos a chamar realtime.send como proprietários da função.
revoke execute on function realtime.send(jsonb, text, text, boolean) from public;
