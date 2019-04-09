package lidraughts.app
package templating

import lidraughts.user.UserContext
import ui.ScalatagsTemplate._

trait StringHelper { self: NumberHelper =>

  def netDomain: String

  val slugify = lidraughts.common.String.slugify _

  def shorten(text: String, length: Int, sep: String = "…") = lidraughts.common.String.shorten(text, length, sep)

  def pluralize(s: String, n: Int) = s"$n $s${if (n > 1) "s" else ""}"

  def repositionTooltipUnsafe(link: Frag, position: String): Frag = raw {
    link.render.replace("<a ", s"""<a data-pt-pos="$position" """)
  }

  def showNumber(n: Int): String = if (n > 0) s"+$n" else n.toString

  implicit def lidraughtsRichString(str: String) = new {
    def active(other: String, one: String = "active") = if (str == other) one else ""
    def activeO(other: String, one: String = "active") = if (str == other) Some(one) else None
  }

  def when(cond: Boolean, str: String) = cond ?? str

  private val NumberFirstRegex = """(\d++)\s(.+)""".r
  private val NumberLastRegex = """\s(\d++)$""".r.unanchored
  def splitNumberUnsafe(s: String)(implicit ctx: UserContext): Frag = raw {
    s match {
      case NumberFirstRegex(number, text) =>
        s"<strong>${(~parseIntOption(number)).localize}</strong><br>$text"
      case NumberLastRegex(n) if s.length > n.length + 1 =>
        s"${s.dropRight(n.length + 1)}<br><strong>${(~parseIntOption(n)).localize}</strong>"
      case h => h.replaceIf('\n', "<br>")
    }
  }
  def splitNumber(s: Frag)(implicit ctx: UserContext): Frag = splitNumberUnsafe(s.render)

  def encodeFen(fen: String) = lidraughts.common.String.base64.encode(fen).reverse

  def addQueryParameter(url: String, key: String, value: Any) =
    if (url contains "?") s"$url&$key=$value" else s"$url?$key=$value"

  def fragList(frags: List[Frag], separator: String = ", "): Frag = frags match {
    case Nil => emptyFrag
    case one :: Nil => one
    case first :: rest => first :: rest.map { f => frag(separator, f) }
  }
}
