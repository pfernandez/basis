; Church numerals and arithmetic helpers for advanced SK examples.

(defn I (x) x)

; Numerals 0–5
(defn ZERO (f x) x)
(defn ONE (f x) (f x))
(defn TWO (f x) (f (f x)))
(defn THREE (f x) (f (f (f x))))
(defn FOUR (f x) (f (f (f (f x)))))
(defn FIVE (f x) (f (f (f (f (f x))))))

; Successor, addition, multiplication
(defn SUCC (n f x) (f ((n f) x)))
(defn PLUS (m n f x) ((m f) ((n f) x)))
(defn MULT (m n f x) ((m (n f)) x))

; Helper to view a Church numeral as a SUCC/ZERO chain
(defn PEANO (n)
  ((n SUCC) ZERO))

; Sample expressions
(defn EXAMPLE-SUM ()
  (PEANO ((PLUS TWO) THREE)))
(defn EXAMPLE-PRODUCT ()
  (PEANO ((MULT THREE) THREE)))
