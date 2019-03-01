gpg --export ${ID} > public.key
gpg --export-secret-key ${ID} > private.key
Move files to new machine, and then:

gpg --import public.key
gpg: nyckel [ID]: public key [Name, e-mail] was imported
gpg: Total number of treated keys: 1
gpg:                 imported: 1  (RSA: 1)

gpg --allow-secret-key-import private.key
sec  [?]/[ID] [Creation date] [Name, e-mail]
ssb  [?]/[SUB-ID] [Creation date]
