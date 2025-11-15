; Core SK basis encoded with explicit re-entry references (De Bruijn `#n`).
; The interpreter rebuilds real binder pointers from these annotations so the
; collapse rule can run without any trusted overrides.
; Identity, constant, and S combinators defined with defn sugar.
(defn I (x) x)
(defn K (x y) x)
(defn S (x y z) ((x z) (y z)))

; TRUE selects the first argument; FALSE selects the second
(defn TRUE (x y) x)
(defn FALSE (x y) y)

; Function composition `B f g x = f (g x)`
(defn B (f g x) (f (g x)))

; Example combinators defined with defn sugar. The `defn` reader rewrites these
; into the same explicit structure above while loading the file, so this is
; purely syntactic sugar for human readers.
(defn LEFT (x y) x)
(defn RIGHT (x y) y)
(defn SELF (x) x)
