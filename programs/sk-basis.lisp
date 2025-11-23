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

; Boolean algebra built from TRUE/FALSE, written without referencing globals so
; reduction stays strictly structural
(defn NOT (p x y) ((p y) x))
(defn AND (p q x y) ((p ((q x) y)) y))
(defn OR (p q x y) ((p x) ((q x) y)))

; Function composition `B f g x = f (g x)`
(defn B (f g x) (f (g x)))
(defn C (f x y) ((f y) x))   ; flip arguments
(defn W (f x) ((f x) x))     ; duplicate argument

; Church pairs and selectors
(defn PAIR (a b f) ((f a) b))
(defn FIRST (p) (p TRUE))
(defn SECOND (p) (p FALSE))

; Example combinators defined with defn sugar. The `defn` reader rewrites these
; into the same explicit structure above while loading the file, so this is
; purely syntactic sugar for human readers.
(defn LEFT (x y) x)
(defn RIGHT (x y) y)
(defn SELF (x) x)

; Church numerals and arithmetic
(defn ZERO (f x) x)
(defn ONE (f x) (f x))
(defn TWO (f x) (f (f x)))
(defn SUCC (n f x) (f ((n f) x)))
(defn ADD (m n f x) ((m f) ((n f) x)))
(defn MUL (m n f x) ((m (n f)) x))

; Applicative-order fixpoint combinator helpers
(defn APPLY-SELF (x v) ((x x) v))
(defn THETA (f x) (f (APPLY-SELF x)))

; Applicative-order fixpoint combinator.
; The classic Y = λf.(λx.f(x x))(λx.f(x x)) diverges under strict (collapse-now)
; evaluation: each (x x) must collapse before f sees its argument. Z uses THETA
; so self-application is only demanded once the body consumes its input.
; If you ever want the lazy variant, Y = (THETA THETA) is the unsafe form.
(defn Z (f) ((THETA f) (THETA f)))
