; Build the SK basis from the leaf (()):
; I  = (()())
; K  = ((()())())
; S  = (((()())())())

(def leaf ())
(def I    (node leaf leaf))
(def K    (node I leaf))
(def S    (node K leaf))
