(define (link x y) (cons x y))
(define (focus frame) (car frame))
(define (next frame) (cdr frame))
(define (atom-frame x) (link x '()))

(define frame
  (link 'A (link 'B (link 'C 'D))))

(define program
  (link focus (link next (link focus '()))))

(define agent
  (link 'agent-id program))

(define (step cursor program)
  (cond
    ((not (pair? cursor)) '())
    (else
     (let ((op (focus program)))
       (step
        (cond
          ((eq? op focus) (focus cursor))
          ((eq? op next) (next cursor))
          (else cursor))
        (next program))))))



#!##############################################################################

(step frame (next agent))

##############################################################################!#

