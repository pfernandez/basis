; Core SK basis encoded with explicit re-entry references (De Bruijn `#n`).
; The interpreter rebuilds real binder pointers from these annotations so the
; collapse rule can run without any trusted overrides.
; Identity, constant, and S combinators with explicit re-entry references
(def I (() #0))
(def K (() (() #1)))
(def S (() (() (() ((#2 #0) (#1 #0))))))

; TRUE selects the first argument; FALSE selects the second
(def TRUE K)
(def FALSE (() (() #0)))

; Function composition `B f g x = f (g x)`
(def B ((S (K S)) K))

; Example combinators defined with defn sugar. The `defn` reader rewrites these
; into the same explicit structure above while loading the file, so this is
; purely syntactic sugar for human readers.
(defn LEFT (x y) x)
(defn RIGHT (x y) y)
(defn SELF (x) x)
