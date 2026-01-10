'use client';
import { ReactNode } from 'react';

type MasonaryProps = {
  children: ReactNode;
  className?: string;
  itemClassName?: string;
};

function Masonary({ children, className, itemClassName }: MasonaryProps) {
  return (
    <div className={`columns-2 md:columns-3 2xl:columns-4 gap-4 ${className ?? ''}`}>
      {Array.isArray(children)
        ? children.map((child, index) => (
            <div
              key={index}
              className={`mb-4 break-inside-avoid ${itemClassName ?? ''}`}
            >
              {child}
            </div>
          ))
        : children}
    </div>
  );
}

export default Masonary;
