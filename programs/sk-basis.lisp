; Core SK basis encoded with explicit re-entry references (De Bruijn `#n`).
; The interpreter rebuilds real binder pointers from these annotations so the
; collapse rule can run without any trusted overrides.
; Identity, constant, and S combinators defined with defn sugar.
(defn I (x) x)
(def id I)

(defn K (x y) x)
(def const K)

(defn S (x y z) ((x z) (y z)))
(def spread S)

; Function composition `B f g x = f (g x)`
(defn B (f g x) (f (g x)))
(def compose B)

(defn C (f x y) ((f y) x))   ; flip arguments
(def flip C)

(defn W (f x) ((f x) x))     ; duplicate argument
(def split W)

; Booleans
(defn true (x y) x)
(defn false (x y) y)

; Thunked conditional to keep evaluation local/structural under strict collapse.
; The evaluator is eager and reduces both branches; passing thunks lets us avoid
; forcing the "other" branch (use as: ((if p) (K then) (K else)) arg).
(defn if (p th el) ((p th) el))

; Boolean algebra built from true/false, written without referencing globals so
; reduction stays strictly structural
(defn not (p x y) ((p y) x))
(defn and (p q x y) ((p ((q x) y)) y))
(defn or (p q x y) ((p x) ((q x) y)))

; Church pairs and selectors
(defn pair (a b f) ((f a) b))
(defn first (p) (p true))
(defn second (p) (p false))

; Currying helpers for convenience
(defn curry (f x y) (f ((pair x) y)))
(defn uncurry (f p) ((f (first p)) (second p)))

; Example combinators defined with defn sugar. The `defn` reader rewrites these
; into the same explicit structure above while loading the file, so this is
; purely syntactic sugar for human readers.
(defn left (x y) x)
(defn right (x y) y)
(defn self (x) x)

; Church numerals and arithmetic (works under current strict collapse)
(defn zero (f x) x)
(defn one (f x) (f x))
(defn two (f x) (f (f x)))
(defn succ (n f x) (f ((n f) x)))
(defn add (m n f x) ((m f) ((n f) x)))
(defn mul (m n f x) ((m (n f)) x))
(defn is-zero (n) ((n (const false)) true))

; TODO: Church lists (nil/cons/is-nil/head/tail/fold/map) under strict collapse

; Applicative-order fixpoint combinator helpers
(defn APPLY-SELF (x v) ((x x) v))
(defn THETA (f x) (f (APPLY-SELF x)))
(def apply-self APPLY-SELF)
(def theta THETA)

; Applicative-order fixpoint combinator.
; The classic Y = λf.(λx.f(x x))(λx.f(x x)) diverges under strict (collapse-now)
; evaluation: each (x x) must collapse before f sees its argument. Z uses THETA
; so self-application is only demanded once the body consumes its input.
; If you ever want the lazy variant, Y = (THETA THETA) is the unsafe form.
(defn Z (f) ((THETA f) (THETA f)))
(def fix Z)
