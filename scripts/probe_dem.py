import numpy as np, sys, math
R=1737.4
a=np.fromfile(sys.argv[1],dtype='<f4').reshape(3812,3812)
print("min/max km",a.min(),a.max())
def px(lat,lon,order):
    rho=2*R*math.tan(math.radians(90+lat)/2)  # km, south polar stereographic true at pole
    lo=math.radians(lon)
    if order=='sin_x_cos_y_down':   x=rho*math.sin(lo); y=rho*math.cos(lo)
    elif order=='cos_x_sin_y':      x=rho*math.cos(lo); y=rho*math.sin(lo)
    c=1905.5-0.5
    return x/0.24+c, y/0.24+c   # col,row candidates
# Malapert massif ~(-85.9, 0.0) high; Shackleton (-89.9,129.8) deep; Haworth (-87.5, -5?) deep
tests={'Shackleton':(-89.9,129.8),'Malapert':(-85.9,0.0),'Cabeus':(-84.9,-35.5),'Haworth':(-87.5,-5.0)}
for order in ['sin_x_cos_y_down','cos_x_sin_y']:
  for sx in (1,-1):
    for sy in (1,-1):
      out=[]
      for n,(la,lo) in tests.items():
        cx,cy=px(la,lo,order); c=1904.5
        col=int(round(c+sx*(cx-c))); row=int(round(c+sy*(cy-c)))
        out.append((n,round(float(a[row,col]),2)))
      print(order,sx,sy,out)
